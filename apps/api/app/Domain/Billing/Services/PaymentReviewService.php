<?php

namespace App\Domain\Billing\Services;

use App\Domain\Communication\NotificationCatalog;
use App\Domain\Communication\NotificationService;
use App\Models\Enrollment;
use App\Models\Entitlement;
use App\Models\PaymentRequest;
use App\Models\PaymentReviewLog;
use App\Models\PlatformUser;
use App\Models\Subscription;
use App\Models\TenantUser;
use App\Support\Audit\AuditLogger;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class PaymentReviewService
{
    /**
     * Approve payment request, activate subscription, and grant entitlements (OD-27, ADR-004).
     * Enforces invariants:
     * - Payment ≠ Subscription
     * - Subscription ≠ Entitlement
     * - Payment Approval ≠ Authentication
     *
     * @return array{payment_request: PaymentRequest, subscription: Subscription, entitlements: array, enrollments: array}
     *
     * @throws \DomainException
     */
    public function approve(
        PaymentRequest $paymentRequest,
        TenantUser|PlatformUser|string|null $reviewer = null,
        ?string $notes = null,
        ?string $periodMonth = null
    ): array {
        if (! $paymentRequest->isPending()) {
            throw new \DomainException('This payment request has already been processed (current status: '.$paymentRequest->status.').');
        }

        $result = DB::transaction(function () use ($paymentRequest, $reviewer, $notes, $periodMonth) {
            $isPlatform = ($reviewer instanceof PlatformUser) || is_string($reviewer);
            $tenantUserId = ($reviewer instanceof TenantUser) ? $reviewer->id : null;
            $platformUserId = ($reviewer instanceof PlatformUser) ? (string) $reviewer->id : (is_string($reviewer) ? $reviewer : null);
            $platformUserName = ($reviewer instanceof PlatformUser) ? $reviewer->name : (is_string($reviewer) ? 'Platform Admin' : null);
            $targetPeriod = $periodMonth ?? $paymentRequest->period_month ?? now()->format('Y-m');

            // 1. Update PaymentRequest
            $paymentRequest->update([
                'status' => 'approved',
                'period_month' => $targetPeriod,
                'reviewed_by_user_id' => $tenantUserId,
                'reviewed_by_platform_user_id' => $platformUserId,
                'reviewed_by_platform_user_name' => $platformUserName,
                'reviewed_at' => now(),
            ]);

            // 2. Record Review Log in tenant DB
            PaymentReviewLog::create([
                'payment_request_id' => $paymentRequest->id,
                'reviewed_by_user_id' => $tenantUserId,
                'reviewed_by_platform_user_id' => $platformUserId,
                'reviewed_by_platform_user_name' => $platformUserName,
                'action' => 'approved',
                'reason' => $notes ?: 'Payment approved after verification.',
                'logged_at' => now(),
            ]);

            // Subscription period: defaults to full calendar month or 30 days
            try {
                $periodDate = Carbon::createFromFormat('Y-m', $targetPeriod);
                $startsAt = $periodDate->copy()->startOfMonth();
                $endsAt = $periodDate->copy()->endOfMonth();
            } catch (\Throwable) {
                $startsAt = now();
                $endsAt = now()->addMonth();
            }

            // 3. Activate Subscription (Payment ≠ Subscription)
            $subscription = Subscription::create([
                'student_id' => $paymentRequest->student_id,
                'package_id' => $paymentRequest->package_id,
                'period_month' => $targetPeriod,
                'payment_request_id' => $paymentRequest->id,
                'status' => 'active',
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
            ]);

            // 4. Grant Entitlements (Subscription ≠ Entitlement)
            $grantedEntitlements = [];
            $paymentRequest->loadMissing('package.entitlements');

            if ($paymentRequest->package && $paymentRequest->package->entitlements->isNotEmpty()) {
                foreach ($paymentRequest->package->entitlements as $pkgEntitlement) {
                    $grantedEntitlements[] = Entitlement::create([
                        'student_id' => $paymentRequest->student_id,
                        'subscription_id' => $subscription->id,
                        'entitlement_key' => $pkgEntitlement->entitlement_key,
                        'is_active' => true,
                        'expires_at' => $subscription->ends_at,
                    ]);
                }
            } else {
                // Monthly student access entitlements per OD-27
                $keys = ['ONLINE_ACCESS', 'all_courses', 'EXAM_ACCESS', 'LIVE_SESSIONS'];
                foreach ($keys as $key) {
                    $grantedEntitlements[] = Entitlement::create([
                        'student_id' => $paymentRequest->student_id,
                        'subscription_id' => $subscription->id,
                        'entitlement_key' => $key,
                        'is_active' => true,
                        'expires_at' => $subscription->ends_at,
                    ]);
                }
            }

            // 5. Auto-Enrollment Side Effect for Entitled Courses (R3-7)
            $createdEnrollments = [];
            foreach ($grantedEntitlements as $ent) {
                if (str_starts_with($ent->entitlement_key, 'course:')) {
                    $courseId = substr($ent->entitlement_key, 7);
                    $createdEnrollments[] = Enrollment::firstOrCreate(
                        [
                            'student_id' => $paymentRequest->student_id,
                            'course_id' => $courseId,
                        ],
                        [
                            'status' => 'active',
                            'enrolled_at' => now(),
                        ]
                    );
                }
            }

            // 6. Centralized Audit Log
            AuditLogger::log(
                action: 'payment.approved',
                entityType: 'PaymentRequest',
                entityId: $paymentRequest->id,
                payload: [
                    'amount' => $paymentRequest->amount,
                    'period_month' => $targetPeriod,
                    'package_id' => $paymentRequest->package_id,
                    'subscription_id' => $subscription->id,
                    'entitlements_count' => count($grantedEntitlements),
                    'enrollments_count' => count($createdEnrollments),
                ],
                actorType: $isPlatform ? 'platform_admin' : 'staff',
                actorId: $platformUserId ?: (string) $tenantUserId
            );

            return [
                'payment_request' => $paymentRequest->fresh(),
                'subscription' => $subscription,
                'entitlements' => $grantedEntitlements,
                'enrollments' => $createdEnrollments,
            ];
        });

        // After commit: a notification failure must not undo the approval.
        // OD-33: Notifications route to both student and parents.
        $paymentRequest->loadMissing('student', 'package');
        if ($paymentRequest->student) {
            app(NotificationService::class)->sendToStudent(
                NotificationCatalog::PAYMENT_APPROVED,
                $paymentRequest->student,
                ['package' => $paymentRequest->package?->name ?? 'اشتراك شهر '.($paymentRequest->period_month ?? '')],
                '/student/subscriptions'
            );
        }

        return $result;
    }

    /**
     * Reject a payment request (OD-27, ADR-004).
     *
     * @throws \DomainException
     */
    public function reject(
        PaymentRequest $paymentRequest,
        TenantUser|PlatformUser|string|null $reviewer = null,
        string $reason = ''
    ): PaymentRequest {
        if (! $paymentRequest->isPending()) {
            throw new \DomainException('This payment request has already been processed (current status: '.$paymentRequest->status.').');
        }

        $result = DB::transaction(function () use ($paymentRequest, $reviewer, $reason) {
            $isPlatform = ($reviewer instanceof PlatformUser) || is_string($reviewer);
            $tenantUserId = ($reviewer instanceof TenantUser) ? $reviewer->id : null;
            $platformUserId = ($reviewer instanceof PlatformUser) ? (string) $reviewer->id : (is_string($reviewer) ? $reviewer : null);
            $platformUserName = ($reviewer instanceof PlatformUser) ? $reviewer->name : (is_string($reviewer) ? 'Platform Admin' : null);

            $paymentRequest->update([
                'status' => 'rejected',
                'rejection_reason' => $reason,
                'reviewed_by_user_id' => $tenantUserId,
                'reviewed_by_platform_user_id' => $platformUserId,
                'reviewed_by_platform_user_name' => $platformUserName,
                'reviewed_at' => now(),
            ]);

            PaymentReviewLog::create([
                'payment_request_id' => $paymentRequest->id,
                'reviewed_by_user_id' => $tenantUserId,
                'reviewed_by_platform_user_id' => $platformUserId,
                'reviewed_by_platform_user_name' => $platformUserName,
                'action' => 'rejected',
                'reason' => $reason,
                'logged_at' => now(),
            ]);

            AuditLogger::log(
                action: 'payment.rejected',
                entityType: 'PaymentRequest',
                entityId: $paymentRequest->id,
                payload: ['reason' => $reason],
                actorType: $isPlatform ? 'platform_admin' : 'staff',
                actorId: $platformUserId ?: (string) $tenantUserId
            );

            return $paymentRequest->fresh();
        });

        $paymentRequest->loadMissing('student', 'package');
        if ($paymentRequest->student) {
            app(NotificationService::class)->sendToStudent(
                NotificationCatalog::PAYMENT_REJECTED,
                $paymentRequest->student,
                ['package' => $paymentRequest->package?->name ?? 'اشتراك شهر '.($paymentRequest->period_month ?? ''), 'reason' => $reason],
                '/student/payments'
            );
        }

        return $result;
    }
}
