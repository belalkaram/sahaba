<?php

namespace App\Http\Controllers\Api\Platform;

use App\Domain\Billing\Services\PaymentReviewService;
use App\Http\Controllers\Controller;
use App\Models\PaymentRequest;
use App\Models\PlatformPaymentReview;
use App\Models\PlatformUser;
use App\Models\Tenant;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use App\Tenancy\TenantRunner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class PlatformPaymentController extends Controller
{
    public function __construct(
        private readonly TenantRunner $runner,
        private readonly PaymentReviewService $reviewService
    ) {}

    /**
     * List payment requests across all tenants with filtering and metrics (OD-27, ADR-004).
     */
    public function index(Request $request): JsonResponse
    {
        $tenantFilter = $request->query('tenant_id');
        $statusFilter = $request->query('status', 'all');
        $periodFilter = $request->query('period_month');
        $search = trim((string) $request->query('search', ''));
        $perPage = min(max((int) $request->query('per_page', 25), 5), 100);
        $page = max((int) $request->query('page', 1), 1);

        $tenantsQuery = Tenant::query();
        if ($tenantFilter) {
            $tenantsQuery->where('id', $tenantFilter);
        }
        $tenants = $tenantsQuery->get();

        $allRequests = collect();
        $totalApprovedAmount = 0.0;
        $pendingCount = 0;
        $approvedCount = 0;
        $rejectedCount = 0;

        foreach ($tenants as $tenant) {
            try {
                $this->runner->run($tenant, function () use (
                    $tenant,
                    $statusFilter,
                    $periodFilter,
                    $search,
                    &$allRequests,
                    &$totalApprovedAmount,
                    &$pendingCount,
                    &$approvedCount,
                    &$rejectedCount
                ) {
                    $query = PaymentRequest::with(['student.user', 'package', 'reviewLogs']);

                    // Count totals for metrics
                    $allTenantRequests = PaymentRequest::all();
                    foreach ($allTenantRequests as $r) {
                        if ($r->status === 'pending') {
                            $pendingCount++;
                        } elseif ($r->status === 'approved') {
                            $approvedCount++;
                            $totalApprovedAmount += (float) $r->amount;
                        } elseif ($r->status === 'rejected') {
                            $rejectedCount++;
                        }
                    }

                    // Apply filters for listing
                    if ($statusFilter && $statusFilter !== 'all') {
                        $query->where('status', $statusFilter);
                    }

                    if ($periodFilter) {
                        $query->where('period_month', $periodFilter);
                    }

                    if ($search !== '') {
                        $term = '%'.strtolower($search).'%';
                        $query->where(function ($q) use ($term) {
                            $q->where('reference_code', 'like', $term)
                                ->orWhere('sender_phone', 'like', $term)
                                ->orWhereHas('student.user', function ($uq) use ($term) {
                                    $uq->where('name', 'like', $term)
                                        ->orWhere('email', 'like', $term)
                                        ->orWhere('phone', 'like', $term);
                                });
                        });
                    }

                    $requests = $query->orderByDesc('submitted_at')->get();

                    foreach ($requests as $item) {
                        $data = $item->toArray();
                        $data['tenant'] = [
                            'id' => $tenant->id,
                            'name' => $tenant->name,
                            'slug' => $tenant->slug,
                        ];
                        $data['proof_url'] = $item->proof_path
                            ? url('/api/v1/platform/payments/'.$tenant->id.'/'.$item->id.'/proof')
                            : $item->proof_url;
                        $allRequests->push($data);
                    }
                });
            } catch (\Throwable) {
                // If a tenant DB is not migrated or unreachable, skip gracefully
                continue;
            }
        }

        // Sort descending by submitted_at
        $sorted = $allRequests->sortByDesc(fn ($item) => $item['submitted_at'] ?? '')->values();
        $totalItems = $sorted->count();
        $pagedItems = $sorted->slice(($page - 1) * $perPage, $perPage)->values();

        return ApiResponse::success([
            'payment_requests' => $pagedItems,
            'metrics' => [
                'total_requests' => $totalItems,
                'pending_count' => $pendingCount,
                'approved_count' => $approvedCount,
                'rejected_count' => $rejectedCount,
                'total_amount_collected' => round($totalApprovedAmount, 2),
            ],
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $totalItems,
                'last_page' => max((int) ceil($totalItems / $perPage), 1),
            ],
        ]);
    }

    /**
     * Show details of a specific payment request across tenant boundary.
     */
    public function show(Request $request, string $tenantId, string $paymentId): JsonResponse
    {
        $tenant = $this->resolveTenant($tenantId);

        return $this->runner->run($tenant, function () use ($tenant, $paymentId) {
            $paymentRequest = PaymentRequest::with([
                'student.user',
                'student.parents.user',
                'package.entitlements',
                'reviewLogs',
                'subscription.entitlements',
            ])->findOrFail($paymentId);

            $data = $paymentRequest->toArray();
            $data['tenant'] = [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
            ];
            $data['proof_url'] = $paymentRequest->proof_path
                ? url('/api/v1/platform/payments/'.$tenant->id.'/'.$paymentRequest->id.'/proof')
                : $paymentRequest->proof_url;

            return ApiResponse::success(['payment_request' => $data]);
        });
    }

    /**
     * View or download uploaded proof file from tenant storage.
     */
    public function proof(Request $request, string $tenantId, string $paymentId)
    {
        $tenant = $this->resolveTenant($tenantId);

        return $this->runner->run($tenant, function () use ($paymentId) {
            $paymentRequest = PaymentRequest::findOrFail($paymentId);

            if (! $paymentRequest->proof_path || ! Storage::disk('local')->exists($paymentRequest->proof_path)) {
                return ApiResponse::error(
                    'PROOF_NOT_FOUND',
                    'No proof document exists for this payment request.',
                    Response::HTTP_NOT_FOUND
                );
            }

            return Storage::disk('local')->response($paymentRequest->proof_path);
        });
    }

    /**
     * Approve payment request, activate subscription and entitlements (OD-27, ADR-004).
     */
    public function approve(Request $request, string $tenantId, string $paymentId): JsonResponse
    {
        $tenant = $this->resolveTenant($tenantId);
        $notes = $request->input('notes');
        $periodMonth = $request->input('period_month');

        /** @var PlatformUser|string|null $reviewer */
        $reviewer = $request->attributes->get('platform_user') ?? $request->attributes->get('platform_actor_id') ?? 'platform_admin';

        return $this->runner->run($tenant, function () use ($tenant, $paymentId, $reviewer, $notes, $periodMonth, $request) {
            $paymentRequest = PaymentRequest::with(['package.entitlements', 'student.user'])->findOrFail($paymentId);

            if (! $paymentRequest->isPending()) {
                return ApiResponse::error(
                    'ALREADY_PROCESSED',
                    'This payment request has already been processed (current status: '.$paymentRequest->status.').',
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }

            $result = $this->reviewService->approve($paymentRequest, $reviewer, $notes, $periodMonth);

            // Record review in Control DB ledger
            $reviewerId = ($reviewer instanceof PlatformUser) ? (string) $reviewer->id : null;
            $reviewerName = ($reviewer instanceof PlatformUser) ? $reviewer->name : 'Platform Super Admin';

            PlatformPaymentReview::create([
                'tenant_id' => $tenant->id,
                'payment_request_id' => $paymentRequest->id,
                'student_id' => $paymentRequest->student_id,
                'reviewer_id' => $reviewerId,
                'reviewer_name' => $reviewerName,
                'action' => 'approved',
                'period_month' => $result['payment_request']->period_month ?? now()->format('Y-m'),
                'amount' => $result['payment_request']->amount,
                'currency' => $result['payment_request']->currency ?? 'SAR',
                'notes' => $notes,
                'reviewed_at' => now(),
            ]);

            AuditLogger::log(
                action: 'platform.payment.approved',
                entityType: 'PaymentRequest',
                entityId: $paymentRequest->id,
                payload: [
                    'tenant_id' => $tenant->id,
                    'student_id' => $paymentRequest->student_id,
                    'period_month' => $result['payment_request']->period_month,
                    'amount' => $result['payment_request']->amount,
                ],
                actorType: (string) $request->attributes->get('platform_actor_type', 'platform_admin'),
                actorId: (string) $request->attributes->get('platform_actor_id', 'platform_admin')
            );

            return ApiResponse::success([
                'payment_request' => $result['payment_request'],
                'subscription' => $result['subscription'],
                'entitlements' => $result['entitlements'],
                'message' => 'Payment approved and subscription activated for month '.$result['payment_request']->period_month.'.',
            ]);
        });
    }

    /**
     * Reject payment request with reason (OD-27, ADR-004).
     */
    public function reject(Request $request, string $tenantId, string $paymentId): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'required|string|max:1000',
        ]);

        $tenant = $this->resolveTenant($tenantId);

        /** @var PlatformUser|string|null $reviewer */
        $reviewer = $request->attributes->get('platform_user') ?? $request->attributes->get('platform_actor_id') ?? 'platform_admin';

        return $this->runner->run($tenant, function () use ($tenant, $paymentId, $reviewer, $validated, $request) {
            $paymentRequest = PaymentRequest::with('student.user')->findOrFail($paymentId);

            if (! $paymentRequest->isPending()) {
                return ApiResponse::error(
                    'ALREADY_PROCESSED',
                    'This payment request has already been processed (current status: '.$paymentRequest->status.').',
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }

            $rejected = $this->reviewService->reject($paymentRequest, $reviewer, $validated['reason']);

            $reviewerId = ($reviewer instanceof PlatformUser) ? (string) $reviewer->id : null;
            $reviewerName = ($reviewer instanceof PlatformUser) ? $reviewer->name : 'Platform Super Admin';

            PlatformPaymentReview::create([
                'tenant_id' => $tenant->id,
                'payment_request_id' => $paymentRequest->id,
                'student_id' => $paymentRequest->student_id,
                'reviewer_id' => $reviewerId,
                'reviewer_name' => $reviewerName,
                'action' => 'rejected',
                'period_month' => $paymentRequest->period_month ?? now()->format('Y-m'),
                'amount' => $paymentRequest->amount,
                'currency' => $paymentRequest->currency ?? 'SAR',
                'notes' => $validated['reason'],
                'reviewed_at' => now(),
            ]);

            AuditLogger::log(
                action: 'platform.payment.rejected',
                entityType: 'PaymentRequest',
                entityId: $paymentRequest->id,
                payload: [
                    'tenant_id' => $tenant->id,
                    'student_id' => $paymentRequest->student_id,
                    'reason' => $validated['reason'],
                ],
                actorType: (string) $request->attributes->get('platform_actor_type', 'platform_admin'),
                actorId: (string) $request->attributes->get('platform_actor_id', 'platform_admin')
            );

            return ApiResponse::success([
                'payment_request' => $rejected,
                'message' => 'Payment request rejected.',
            ]);
        });
    }

    /**
     * Reports: monthly revenue, overdue students per tenant, paid students per teacher (P4).
     */
    public function reports(Request $request): JsonResponse
    {
        $tenants = Tenant::where('status', 'active')->get();
        $monthlyRevenue = [];
        $tenantSummaries = [];

        foreach ($tenants as $tenant) {
            try {
                $this->runner->run($tenant, function () use ($tenant, &$monthlyRevenue, &$tenantSummaries) {
                    $requests = PaymentRequest::with('student')->get();
                    $approved = $requests->where('status', 'approved');
                    $pending = $requests->where('status', 'pending');

                    foreach ($approved as $p) {
                        $month = $p->period_month ?? $p->submitted_at?->format('Y-m') ?? now()->format('Y-m');
                        $monthlyRevenue[$month] = ($monthlyRevenue[$month] ?? 0.0) + (float) $p->amount;
                    }

                    $tenantSummaries[] = [
                        'tenant_id' => $tenant->id,
                        'tenant_name' => $tenant->name,
                        'tenant_slug' => $tenant->slug,
                        'paid_students_count' => $approved->pluck('student_id')->unique()->count(),
                        'pending_requests_count' => $pending->count(),
                        'total_collected' => round($approved->sum('amount'), 2),
                    ];
                });
            } catch (\Throwable) {
                continue;
            }
        }

        return ApiResponse::success([
            'monthly_revenue' => $monthlyRevenue,
            'tenants' => $tenantSummaries,
        ]);
    }

    private function resolveTenant(string $tenantId): Tenant
    {
        return Tenant::where('id', $tenantId)->orWhere('slug', $tenantId)->firstOrFail();
    }
}
