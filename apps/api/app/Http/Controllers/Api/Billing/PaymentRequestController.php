<?php

namespace App\Http\Controllers\Api\Billing;

use App\Domain\Billing\Services\PaymentReviewService;
use App\Domain\Communication\NotificationCatalog;
use App\Domain\Communication\NotificationService;
use App\Http\Controllers\Controller;
use App\Models\Package;
use App\Models\PaymentRequest;
use App\Models\PlatformPricing;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class PaymentRequestController extends Controller
{
    /**
     * List payment requests.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $query = PaymentRequest::with(['student.user', 'package', 'reviewer']);

        if (! $user->hasPermissionTo('payments.view')) {
            if ($user->student) {
                $query->where('student_id', $user->student->id);
            } else {
                return ApiResponse::success(['payment_requests' => []]);
            }
        }

        $requests = $query->orderBy('submitted_at', 'desc')->get();

        return ApiResponse::success(['payment_requests' => $requests]);
    }

    /**
     * Student submits a payment request with optional multipart proof file.
     */
    public function store(Request $request, TenantContext $tenantContext): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->student) {
            return ApiResponse::error(
                'NOT_A_STUDENT',
                'Only authenticated students can submit payment requests.',
                Response::HTTP_FORBIDDEN
            );
        }

        $validated = $request->validate([
            'package_id' => 'nullable|uuid|exists:tenant.packages,id',
            'period_month' => ['nullable', 'string', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'amount' => 'nullable|numeric|min:0',
            'payment_method' => 'required|string|in:instapay,cash,bank_transfer',
            'sender_phone' => 'nullable|string|max:30',
            'reference_code' => 'nullable|string|max:100',
            'proof' => 'nullable|file|mimes:jpeg,jpg,png,pdf|max:5120',
            'proof_url' => 'nullable|string|max:500',
        ]);

        $tenant = $tenantContext->getTenant();
        $pricing = PlatformPricing::getForTenant($tenant?->id);

        $proofPath = null;
        if ($request->hasFile('proof')) {
            $tenantSlug = $tenant ? $tenant->slug : 'default';
            $proofPath = $request->file('proof')->store('tenants/'.$tenantSlug.'/proofs', 'local');
        }

        $package = ! empty($validated['package_id']) ? Package::find($validated['package_id']) : null;
        $amount = isset($validated['amount']) ? (float) $validated['amount'] : (float) ($package?->price ?? $pricing->student_monthly_fee);
        $currency = $package?->currency ?? $pricing->currency ?? 'SAR';
        $periodMonth = $validated['period_month'] ?? now()->format('Y-m');

        $paymentRequest = PaymentRequest::create([
            'student_id' => $user->student->id,
            'package_id' => $package?->id,
            'period_month' => $periodMonth,
            'amount' => $amount,
            'currency' => $currency,
            'payment_method' => $validated['payment_method'],
            'sender_phone' => $validated['sender_phone'] ?? null,
            'reference_code' => $validated['reference_code'] ?? null,
            'proof_url' => $validated['proof_url'] ?? null,
            'proof_path' => $proofPath,
            'status' => 'pending',
            'submitted_at' => now(),
        ]);

        $notifier = app(NotificationService::class);
        $notifier->send(
            NotificationCatalog::PAYMENT_SUBMITTED,
            $notifier->usersWithPermission('payments.approve'),
            ['student' => $user->name, 'package' => $package?->name ?? 'اشتراك شهر '.$periodMonth],
            '/teacher/payments'
        );

        return ApiResponse::success([
            'payment_request' => $paymentRequest->load(['student.user', 'package']),
        ], Response::HTTP_CREATED);
    }

    /**
     * Show payment request details.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $paymentRequest = PaymentRequest::with([
            'student.user',
            'package.entitlements',
            'reviewer',
            'reviewLogs.reviewer',
            'subscription.entitlements',
        ])->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();

        $isOwner = $user->student
            && $user->student->id === $paymentRequest->student_id;

        $isStaffReviewer = ($user->staff || $user->type === 'staff')
            && ($user->hasPermissionTo('payments.view')
                || $user->hasPermissionTo('payments.approve')
                || $user->hasPermissionTo('payments.reject'));

        if (! $isOwner && ! $isStaffReviewer) {
            return ApiResponse::error(
                'FORBIDDEN',
                'You do not have permission to view this payment request.',
                Response::HTTP_FORBIDDEN
            );
        }

        return ApiResponse::success(['payment_request' => $paymentRequest]);
    }

    /**
     * View or download the uploaded proof file for a payment request.
     */
    public function proof(Request $request, string $id)
    {
        $paymentRequest = PaymentRequest::findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();

        $isOwner = $user->student
            && $user->student->id === $paymentRequest->student_id;

        $isStaffReviewer = ($user->staff || $user->type === 'staff')
            && ($user->hasPermissionTo('payments.view')
                || $user->hasPermissionTo('payments.approve')
                || $user->hasPermissionTo('payments.reject'));

        if (! $isOwner && ! $isStaffReviewer) {
            return ApiResponse::error(
                'FORBIDDEN',
                'You do not have permission to view this payment proof.',
                Response::HTTP_FORBIDDEN
            );
        }

        if (! $paymentRequest->proof_path || ! Storage::disk('local')->exists($paymentRequest->proof_path)) {
            return ApiResponse::error(
                'PROOF_NOT_FOUND',
                'No payment proof file was uploaded for this request.',
                Response::HTTP_NOT_FOUND
            );
        }

        return Storage::disk('local')->response($paymentRequest->proof_path);
    }

    /**
     * Approve payment request.
     */
    public function approve(Request $request, string $id, PaymentReviewService $reviewService): JsonResponse
    {
        $paymentRequest = PaymentRequest::with('package.entitlements')->findOrFail($id);

        try {
            $result = $reviewService->approve($paymentRequest, $request->user(), $request->input('notes'));

            return ApiResponse::success([
                'payment_request' => $result['payment_request'],
                'subscription' => $result['subscription'],
                'entitlements' => $result['entitlements'],
                'enrollments' => $result['enrollments'] ?? [],
                'message' => 'Payment approved, subscription activated, and entitlements granted successfully.',
            ]);
        } catch (\DomainException $e) {
            return ApiResponse::error(
                'ALREADY_PROCESSED',
                $e->getMessage(),
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }
    }

    /**
     * Reject payment request.
     */
    public function reject(Request $request, string $id, PaymentReviewService $reviewService): JsonResponse
    {
        $paymentRequest = PaymentRequest::findOrFail($id);

        $validated = $request->validate([
            'reason' => 'required|string|max:1000',
        ]);

        try {
            $rejected = $reviewService->reject($paymentRequest, $request->user(), $validated['reason']);

            return ApiResponse::success([
                'payment_request' => $rejected,
                'message' => 'Payment request rejected.',
            ]);
        } catch (\DomainException $e) {
            return ApiResponse::error(
                'ALREADY_PROCESSED',
                $e->getMessage(),
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }
    }

    /**
     * Get active pricing & payment transfer details for this tenant (OD-27).
     */
    public function pricing(TenantContext $tenantContext): JsonResponse
    {
        $tenant = $tenantContext->getTenant();
        $pricing = PlatformPricing::getForTenant($tenant?->id);

        return ApiResponse::success([
            'student_monthly_fee' => (float) $pricing->student_monthly_fee,
            'currency' => $pricing->currency,
            'receiving_account_type' => $pricing->receiving_account_type,
            'bank_name' => $pricing->bank_name,
            'account_holder_name' => $pricing->account_holder_name,
            'iban' => $pricing->iban,
            'transfer_instructions' => $pricing->transfer_instructions,
        ]);
    }
}
