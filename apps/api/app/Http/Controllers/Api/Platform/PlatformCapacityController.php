<?php

namespace App\Http\Controllers\Api\Platform;

use App\Domain\Platform\Capacity\TenantCapacityService;
use App\Http\Controllers\Controller;
use App\Models\CapacityRequest;
use App\Models\PlatformSetting;
use App\Models\Tenant;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use App\Tenancy\TenantRunner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * ADR-006 (CAP-1): only the platform super admin grants capacity. Every change is audited.
 */
class PlatformCapacityController extends Controller
{
    public function __construct(private readonly TenantRunner $runner) {}

    /** GET /platform/capacity/requests?status= */
    public function requests(Request $request): JsonResponse
    {
        $request->validate(['status' => ['nullable', Rule::in(['pending', 'approved', 'rejected'])]]);
        $query = CapacityRequest::with('tenant:id,name,slug,type,seat_quota')->latest();
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        $page = $query->paginate(min(50, max(1, (int) $request->input('per_page', 20))));

        return ApiResponse::success(
            ['requests' => collect($page->items())->map(fn (CapacityRequest $r) => $this->present($r))->all()],
            Response::HTTP_OK,
            ['pagination' => ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()]],
        );
    }

    /** GET /platform/capacity/requests/{id}/proof */
    public function proof(string $id)
    {
        $capacityRequest = CapacityRequest::findOrFail($id);
        if (! $capacityRequest->proof_path || ! Storage::disk('local')->exists($capacityRequest->proof_path)) {
            return ApiResponse::error('PROOF_NOT_FOUND', 'No proof document for this request.', Response::HTTP_NOT_FOUND);
        }

        return Storage::disk('local')->response($capacityRequest->proof_path);
    }

    /** POST /platform/capacity/requests/{id}/approve {seats_granted?, note?} */
    public function approve(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'seats_granted' => 'nullable|integer|min:1|max:100000',
            'note' => 'nullable|string|max:1000',
        ]);
        [$actorId, $actorName] = $this->actor($request);

        $result = DB::transaction(function () use ($id, $validated, $actorId, $actorName) {
            /** @var CapacityRequest $capacityRequest */
            $capacityRequest = CapacityRequest::lockForUpdate()->findOrFail($id);
            if ($capacityRequest->status !== 'pending') {
                return $capacityRequest; // idempotent: already decided
            }
            /** @var Tenant $tenant */
            $tenant = Tenant::lockForUpdate()->findOrFail($capacityRequest->tenant_id);
            $current = $tenant->seat_quota ?? $this->usageOf($tenant);
            $granted = (int) ($validated['seats_granted'] ?? $capacityRequest->seats_requested);
            $tenant->forceFill(['seat_quota' => $current + $granted])->save();

            $capacityRequest->update([
                'status' => 'approved',
                'seats_granted' => $granted,
                'quota_after' => $current + $granted,
                'reviewed_by' => $actorId,
                'reviewed_by_name' => $actorName,
                'reviewed_at' => now(),
                'decision_note' => $validated['note'] ?? null,
            ]);

            AuditLogger::log(action: 'platform.capacity.approved', tenantId: $tenant->id, entityType: 'CapacityRequest', entityId: $capacityRequest->id, payload: ['seats_granted' => $granted, 'quota_before' => $current, 'quota_after' => $current + $granted], actorType: 'platform_user', actorId: $actorId);

            return $capacityRequest;
        });

        return ApiResponse::success(['request' => $this->present($result->load('tenant:id,name,slug,type,seat_quota'))]);
    }

    /** POST /platform/capacity/requests/{id}/reject {reason} */
    public function reject(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate(['reason' => 'required|string|max:1000']);
        [$actorId, $actorName] = $this->actor($request);

        $capacityRequest = CapacityRequest::findOrFail($id);
        if ($capacityRequest->status !== 'pending') {
            return ApiResponse::error('ALREADY_DECIDED', 'This request has already been decided.', Response::HTTP_CONFLICT);
        }
        $capacityRequest->update([
            'status' => 'rejected',
            'reviewed_by' => $actorId,
            'reviewed_by_name' => $actorName,
            'reviewed_at' => now(),
            'decision_note' => $validated['reason'],
        ]);
        AuditLogger::log(action: 'platform.capacity.rejected', tenantId: $capacityRequest->tenant_id, entityType: 'CapacityRequest', entityId: $capacityRequest->id, payload: ['reason' => $validated['reason']], actorType: 'platform_user', actorId: $actorId);

        return ApiResponse::success(['request' => $this->present($capacityRequest->load('tenant:id,name,slug,type,seat_quota'))]);
    }

    /** GET /platform/capacity/tenants — quota and live usage per academy. */
    public function tenants(Request $request): JsonResponse
    {
        $query = Tenant::query()->orderBy('name');
        if ($request->filled('search')) {
            $term = '%'.$request->input('search').'%';
            $query->where(fn ($q) => $q->where('name', 'like', $term)->orWhere('slug', 'like', $term));
        }
        $page = $query->paginate(min(50, max(1, (int) $request->input('per_page', 20))));

        $rows = collect($page->items())->map(function (Tenant $tenant) {
            $used = null;
            try {
                $used = $this->usageOf($tenant);
            } catch (\Throwable) {
                // A tenant whose database is not ready shows no usage instead of failing the whole list.
            }

            return ['id' => $tenant->id, 'name' => $tenant->name, 'slug' => $tenant->slug, 'type' => $tenant->type, 'status' => $tenant->status, 'seat_quota' => $tenant->seat_quota, 'used' => $used];
        });

        return ApiResponse::success(
            ['tenants' => $rows->all(), 'default_seat_quota' => TenantCapacityService::defaultQuota()],
            Response::HTTP_OK,
            ['pagination' => ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()]],
        );
    }

    /** PUT /platform/capacity/tenants/{id} {seat_quota, reason} — direct correction by the super admin. */
    public function setQuota(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate(['seat_quota' => 'required|integer|min:0|max:1000000', 'reason' => 'required|string|max:500']);
        [$actorId] = $this->actor($request);
        $tenant = Tenant::findOrFail($id);
        $before = $tenant->seat_quota;
        $tenant->forceFill(['seat_quota' => (int) $validated['seat_quota']])->save();
        AuditLogger::log(action: 'platform.capacity.quota_set', tenantId: $tenant->id, entityType: 'Tenant', entityId: $tenant->id, payload: ['before' => $before, 'after' => $tenant->seat_quota, 'reason' => $validated['reason']], actorType: 'platform_user', actorId: $actorId);

        return ApiResponse::success(['tenant' => ['id' => $tenant->id, 'seat_quota' => $tenant->seat_quota]]);
    }

    /** PUT /platform/capacity/default {default_seat_quota} — seats a new academy starts with. */
    public function setDefault(Request $request): JsonResponse
    {
        $validated = $request->validate(['default_seat_quota' => 'required|integer|min:0|max:1000000']);
        [$actorId] = $this->actor($request);
        $before = TenantCapacityService::defaultQuota();
        PlatformSetting::setValue(TenantCapacityService::DEFAULT_QUOTA_SETTING, (int) $validated['default_seat_quota'], $actorId);
        AuditLogger::log(action: 'platform.capacity.default_set', entityType: 'PlatformSetting', entityId: TenantCapacityService::DEFAULT_QUOTA_SETTING, payload: ['before' => $before, 'after' => (int) $validated['default_seat_quota']], actorType: 'platform_user', actorId: $actorId);

        return ApiResponse::success(['default_seat_quota' => TenantCapacityService::defaultQuota()]);
    }

    private function usageOf(Tenant $tenant): int
    {
        return (int) $this->runner->run($tenant, fn () => app(TenantCapacityService::class)->used());
    }

    /** @return array{0: string, 1: string} */
    private function actor(Request $request): array
    {
        $user = $request->attributes->get('platform_user');

        return [(string) ($request->attributes->get('platform_actor_id') ?? 'platform_admin'), (string) ($user->name ?? 'Platform admin')];
    }

    /** @return array<string, mixed> */
    private function present(CapacityRequest $r): array
    {
        return [
            'id' => $r->id,
            'tenant' => $r->tenant ? ['id' => $r->tenant->id, 'name' => $r->tenant->name, 'slug' => $r->tenant->slug, 'type' => $r->tenant->type, 'seat_quota' => $r->tenant->seat_quota] : null,
            'seats_requested' => $r->seats_requested,
            'amount' => $r->amount !== null ? (float) $r->amount : null,
            'currency' => $r->currency,
            'note' => $r->note,
            'has_proof' => (bool) $r->proof_path,
            'status' => $r->status,
            'requested_by_name' => $r->requested_by_name,
            'seats_used_at_request' => $r->seats_used_at_request,
            'quota_at_request' => $r->quota_at_request,
            'seats_granted' => $r->seats_granted,
            'quota_after' => $r->quota_after,
            'reviewed_by_name' => $r->reviewed_by_name,
            'reviewed_at' => $r->reviewed_at?->toIso8601String(),
            'decision_note' => $r->decision_note,
            'created_at' => $r->created_at?->toIso8601String(),
        ];
    }
}
