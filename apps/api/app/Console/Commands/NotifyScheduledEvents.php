<?php

namespace App\Console\Commands;

use App\Domain\Communication\NotificationCatalog;
use App\Domain\Communication\NotificationService;
use App\Models\Assignment;
use App\Models\Enrollment;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Tenancy\TenantRunner;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * R8-1: time-based notifications (expiring subscriptions, assignments due soon) for every active
 * tenant. Safe to run repeatedly: each subject notifies a user only once (dedupe key).
 */
class NotifyScheduledEvents extends Command
{
    protected $signature = 'lms:notify-scheduled';

    protected $description = 'Send expiring-subscription and assignment-due notifications for all active tenants';

    public function handle(TenantRunner $runner, NotificationService $notifier): int
    {
        foreach (Tenant::where('status', 'active')->get() as $tenant) {
            try {
                $runner->run($tenant, function () use ($notifier) {
                    $this->subscriptions($notifier);
                    $this->assignments($notifier);
                });
            } catch (Throwable $e) {
                // One broken tenant database must not stop the others.
                Log::warning('Scheduled notifications failed for tenant', ['tenant_id' => $tenant->id, 'error' => $e->getMessage()]);
            }
        }

        return self::SUCCESS;
    }

    private function subscriptions(NotificationService $notifier): void
    {
        Subscription::with('student.user', 'student.parents.user', 'package')
            ->where('status', 'active')
            ->whereBetween('ends_at', [now(), now()->addDays(7)])
            ->get()
            ->each(function (Subscription $subscription) use ($notifier) {
                if (! $subscription->student) {
                    return;
                }

                $notifier->sendToStudent(
                    NotificationCatalog::SUBSCRIPTION_EXPIRING,
                    $subscription->student,
                    ['package' => $subscription->package?->name, 'date' => NotificationCatalog::date($subscription->ends_at)],
                    '/student/subscriptions',
                    dedupeKey: "subscription_expiring:{$subscription->id}"
                );
            });
    }

    private function assignments(NotificationService $notifier): void
    {
        Assignment::query()
            ->where('status', 'published')
            ->whereBetween('due_at', [now(), now()->addDay()])
            ->get()
            ->each(function (Assignment $assignment) use ($notifier) {
                $submitted = $assignment->submissions()->pluck('student_id');

                $users = Enrollment::with('student.user')
                    ->where('course_id', $assignment->course_id)
                    ->where('status', 'active')
                    ->whereNotIn('student_id', $submitted)
                    ->get()
                    ->map(fn ($enrollment) => $enrollment->student?->user);

                $notifier->send(
                    NotificationCatalog::ASSIGNMENT_DUE,
                    $users,
                    ['title' => $assignment->title, 'date' => NotificationCatalog::date($assignment->due_at)],
                    '/student/assignments',
                    "assignment_due:{$assignment->id}"
                );
            });
    }
}
