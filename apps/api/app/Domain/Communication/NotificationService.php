<?php

namespace App\Domain\Communication;

use App\Jobs\ComputeStudentAnalytics;
use App\Jobs\SendNotificationEmail;
use App\Jobs\SendWhatsAppMessage;
use App\Models\NotificationPreference;
use App\Models\Student;
use App\Models\TenantSetting;
use App\Models\TenantUser;
use App\Notifications\TenantEventNotification;
use App\Tenancy\TenantContext;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * R8-1: maps an event to its recipients and channels (per user preference).
 * OD-33: Automatic routing to student/parent, WhatsApp adapter channel, and opt-in enforcement.
 * A notification failure never breaks the business action that triggered it.
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
        if ($recipients->isEmpty()) {
            return 0;
        }

        $preferences = NotificationPreference::where('event_key', $event)
            ->whereIn('user_id', $recipients->pluck('id'))
            ->get()
            ->keyBy('user_id');

        $whatsAppTemplate = $template['whatsapp_template'] ?? null;
        $isWhatsAppEnabled = (bool) (TenantSetting::getValue(TenantSetting::WHATSAPP_ENABLED, config('services.whatsapp.enabled', false)));
        $allowedWhatsAppEvents = TenantSetting::getValue(TenantSetting::WHATSAPP_EVENTS);
        $isEventWhatsAppAllowed = empty($allowedWhatsAppEvents) || (is_array($allowedWhatsAppEvents) && in_array($event, $allowedWhatsAppEvents, true));

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
                $whatsAppPref = $preference?->whatsapp ?? true;

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

                // WhatsApp dispatch (Meta WhatsApp Business Cloud API via adapter)
                if ($whatsAppTemplate && $isWhatsAppEnabled && $isEventWhatsAppAllowed && $whatsAppPref && ! empty($user->phone)) {
                    $user->loadMissing('parentProfile');
                    $optedIn = ! $user->parentProfile || $user->parentProfile->whatsapp_opt_in;

                    if ($optedIn) {
                        $tenantId = $this->context->getTenantId() ?? (string) $user->tenant_id;
                        if ($tenantId) {
                            SendWhatsAppMessage::dispatch(
                                $tenantId,
                                (string) $user->phone,
                                $whatsAppTemplate,
                                $params,
                                $user->id,
                                $event
                            );
                        }
                    }
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
     * Notify a student (deep link for the student) and/or their parents per OD-33 routing rules.
     *
     * @param  array<string, scalar|null>  $params
     */
    public function sendToStudent(string $event, Student $student, array $params = [], ?string $url = null, ?bool $includeParents = null, ?string $dedupeKey = null): void
    {
        $student->loadMissing('user', 'parents.user');

        $routing = NotificationCatalog::recipients($event);
        $notifyStudent = ($routing === 'student' || $routing === 'both');
        $notifyParents = ($includeParents !== null) ? $includeParents : ($routing === 'parent' || $routing === 'both');

        if (! isset($params['student']) && $student->user) {
            $params['student'] = $student->user->name;
        }

        if ($notifyStudent && $student->user) {
            $this->send($event, [$student->user], $params, $url, $dedupeKey);
        }

        if ($notifyParents) {
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
                $this->sendToStudent(NotificationCatalog::GRADE_PUBLISHED, $student, [
                    'title' => $title,
                    'student' => $student->user?->name ?? 'الطالب',
                ], '/student/grades');

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
