<?php

namespace App\Domain\Communication;

use App\Jobs\ComputeStudentAnalytics;
use App\Jobs\SendNotificationEmail;
use App\Models\NotificationPreference;
use App\Models\Student;
use App\Models\TenantUser;
use App\Notifications\TenantEventNotification;
use App\Tenancy\TenantContext;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * R8-1: maps an event to its recipients and channels (per user preference).
 * A notification failure never breaks the business action that triggered it.
 * WhatsApp is not implemented (FR-NOTIFY-003, future).
 */
class NotificationService
{
    public function __construct(private readonly TenantContext $context) {}

    /**
     * @param  iterable<TenantUser>  $users
     * @param  array<string, scalar|null>  $params
     * @return int Number of users notified on at least one channel
     */
    public function send(string $event, iterable $users, array $params = [], ?string $url = null, ?string $dedupeKey = null): int
    {
        $template = NotificationCatalog::all()[$event] ?? null;
        if (! $template) {
            Log::warning('Unknown notification event', ['event' => $event]);

            return 0;
        }

        $title = NotificationCatalog::render($template['title'], $params);
        $message = NotificationCatalog::render($template['message'], $params);
        $count = 0;

        $recipients = collect($users)->filter()->unique('id');
        $preferences = NotificationPreference::where('event_key', $event)
            ->whereIn('user_id', $recipients->pluck('id'))
            ->get()
            ->keyBy('user_id');

        foreach ($recipients as $user) {
            try {
                if ($user->status !== 'active') {
                    continue;
                }

                if ($dedupeKey && $this->alreadySent($user, $dedupeKey)) {
                    continue;
                }

                $preference = $preferences->get($user->id);
                $inApp = $preference?->in_app ?? true;
                $mail = $preference?->mail ?? $template['mail'];

                if ($inApp) {
                    $user->notify(new TenantEventNotification($event, $title, $message, $url, $dedupeKey));
                }

                if ($mail && $user->email && $user->type !== 'support') {
                    $tenant = $this->context->getTenant();
                    SendNotificationEmail::dispatch(
                        $user->email,
                        (string) $user->name,
                        (string) ($tenant?->name ?? config('app.name')),
                        $title,
                        $message,
                        $tenant?->primary_color,
                    );
                }

                if ($inApp || $mail) {
                    $count++;
                }
            } catch (Throwable $e) {
                Log::warning('Notification delivery failed', [
                    'event' => $event,
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $count;
    }

    /**
     * Notify a student (deep link for the student) and, optionally, their parents.
     *
     * @param  array<string, scalar|null>  $params
     */
    public function sendToStudent(string $event, Student $student, array $params = [], ?string $url = null, bool $includeParents = true, ?string $dedupeKey = null): void
    {
        $student->loadMissing('user', 'parents.user');
        $this->send($event, array_filter([$student->user]), $params, $url, $dedupeKey);

        if ($includeParents) {
            $this->send($event, $this->parentUsers($student), $params, '/parent/dashboard', $dedupeKey);
        }
    }

    /**
     * Notify students (and parents) that a grade was published, then refresh their analytics.
     *
     * @param  iterable<string>  $studentIds
     */
    public function gradesPublished(iterable $studentIds, string $title): void
    {
        $tenantId = $this->context->getTenantId();

        Student::with('user', 'parents.user')->whereIn('id', collect($studentIds)->unique())->get()
            ->each(function (Student $student) use ($title, $tenantId) {
                $this->sendToStudent(NotificationCatalog::GRADE_PUBLISHED, $student, ['title' => $title], '/student/grades');
                if ($tenantId) {
                    ComputeStudentAnalytics::dispatch($tenantId, $student->id);
                }
            });
    }

    /**
     * @return Collection<int, TenantUser>
     */
    public function parentUsers(Student $student): Collection
    {
        $student->loadMissing('parents.user');

        return $student->parents->map(fn ($parent) => $parent->user)->filter()->values();
    }

    /**
     * @return Collection<int, TenantUser>
     */
    public function usersWithPermission(string $permission): Collection
    {
        return TenantUser::query()
            ->where('status', 'active')
            ->whereHas('roles.permissions', fn ($q) => $q->where('name', $permission))
            ->get();
    }

    /**
     * @return Collection<int, TenantUser>
     */
    public function usersWithRole(string $role): Collection
    {
        return TenantUser::query()
            ->where('status', 'active')
            ->whereHas('roles', fn ($q) => $q->where('name', $role))
            ->get();
    }

    private function alreadySent(TenantUser $user, string $dedupeKey): bool
    {
        return $user->notifications()
            ->where('data', 'like', '%'.json_encode($dedupeKey).'%')
            ->exists();
    }
}
