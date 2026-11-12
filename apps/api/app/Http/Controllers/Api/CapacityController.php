<?php

namespace App\Http\Controllers\Api;

use App\Domain\Platform\Capacity\TenantCapacityService;
use App\Http\Controllers\Controller;
use App\Models\CapacityRequest;
use App\Models\PlatformPricing;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * ADR-006 (CAP-1): the academy side of capacity. It can see its seats and ask the super admin for more;
 * it can never change its quota. The tenant id always comes from the resolved tenant context, never the client.
 */
class CapacityController extends Controller
{
    public function __construct(
        private readonly TenantCapacityService $capacity,
        private readonly TenantContext $context,
    ) {}

    /** GET /tenant/capacity */
    public function show(): JsonResponse
    {
        $tenantId = (string) $this->context->getTenantId();
        $pricing = PlatformPricing::getForTenant($tenantId);

        return ApiResponse::success([
            'capacity' => $this->capacity->summary(),
            'pending_request' => $this->present(CapacityRequest::where('tenant_id', $tenantId)->where('status', 'pending')->latest()->first()),
            'transfer' => $pricing ? [
                'bank_name' => $pricing->bank_name,
                'account_holder_name' => $pricing->account_holder_name,
                'iban' => $pricing->iban,
                'instructions' => $pricing->transfer_instructions,
                'currency' => $pricing->currency ?? 'SAR',
            ] : null,
        ]);
    }

    /** GET /tenant/capacity-requests */
    public function index(): JsonResponse
    {
        $items = CapacityRequest::where('tenant_id', (string) $this->context->getTenantId())->latest()->limit(50)->get();

        return ApiResponse::success(['requests' => $items->map(fn ($r) => $this->present($r))->all()]);
    }

    /** POST /tenant/capacity-requests (multipart: seats, amount, proof, note) */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'seats' => 'required|integer|min:1|max:100000',
            'amount' => 'required|numeric|min:0|max:10000000',
            'proof' => 'required|file|mimes:jpg,jpeg,png,webp,pdf|max:5120',
            'note' => 'nullable|string|max:1000',
        ]);

        $tenantId = (string) $this->context->getTenantId();
        if (CapacityRequest::where('tenant_id', $tenantId)->where('status', 'pending')->exists()) {
            return ApiResponse::error('REQUEST_PENDING', 'لديك طلب زيادة قيد المراجعة بالفعل. انتظر قرار إدارة المنصة.', Response::HTTP_CONFLICT);
        }

        /** @var TenantUser $user */
        $user = $request->user();
        $file = $validated['proof'];
        $path = $file->storeAs('capacity-proofs/'.$tenantId, Str::uuid7().'.'.$file->extension(), 'local');
        $summary = $this->capacity->summary();

        $capacityRequest = CapacityRequest::create([
            'tenant_id' => $tenantId,
            'seats_requested' => (int) $validated['seats'],
            'amount' => $validated['amount'],
            'currency' => 'SAR',
            'proof_path' => $path,
            'note' => $validated['note'] ?? null,
            'status' => 'pending',
            'requested_by_user_id' => $user->id,
            'requested_by_name' => $user->name,
            'seats_used_at_request' => $summary['used'],
            'quota_at_request' => $summary['quota'],
        ]);

        AuditLogger::log(
            action: 'tenant.capacity.requested',
            tenantId: $tenantId,
            entityType: 'CapacityRequest',
            entityId: $capacityRequest->id,
            payload: ['seats' => $capacityRequest->seats_requested, 'amount' => (string) $capacityRequest->amount],
            actorType: 'staff',
            actorId: $user->id,
        );

        return ApiResponse::success(['request' => $this->present($capacityRequest)], Response::HTTP_CREATED);
    }

    /** @return array<string, mixed>|null */
    private function present(?CapacityRequest $r): ?array
    {
        return $r ? [
            'id' => $r->id,
            'seats_requested' => $r->seats_requested,
            'amount' => $r->amount !== null ? (float) $r->amount : null,
            'currency' => $r->currency,
            'note' => $r->note,
            'status' => $r->status,
            'requested_by_name' => $r->requested_by_name,
            'seats_granted' => $r->seats_granted,
            'quota_after' => $r->quota_after,
            'decision_note' => $r->decision_note,
            'reviewed_at' => $r->reviewed_at?->toIso8601String(),
            'created_at' => $r->created_at?->toIso8601String(),
        ] : null;
    }
}
