<?php

namespace App\Domain\Communication;

use App\Models\Announcement;
use App\Models\AnnouncementRecipient;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\TenantUser;
use App\Support\Audit\AuditLogger;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * OD-37 (ANN-1): academy announcements.
 *
 * Audience = which students (all / courses / classes / grades / chosen students) and whether the students and/or their
 * parents receive it. It is resolved once, at publish time, into `announcement_recipients`.
 *
 * Scope of `notifications.send`: `tenant` may target anyone; `own` (teacher) only their own courses or students
 * enrolled in them. Anything else is refused (fail closed).
 */
class AnnouncementService
{
    public const TARGETS = ['all', 'courses', 'classes', 'grades', 'students'];

    public function __construct(private readonly NotificationService $notifications) {}

    /**
     * @param  array{target: string, ids?: array<int, string>, students?: bool, parents?: bool}  $audience
     * @return Collection<int, array{user: TenantUser, role: string, student_id: string}>
     */
    public function resolve(array $audience, TenantUser $sender): Collection
    {
        $students = $this->students($audience, $sender);
        $withStudents = (bool) ($audience['students'] ?? true);
        $withParents = (bool) ($audience['parents'] ?? false);

        $students->load(['user', 'parents.user']);

        $people = collect();
        foreach ($students as $student) {
            if ($withStudents && $student->user && $student->user->status === 'active') {
                $people->push(['user' => $student->user, 'role' => 'student', 'student_id' => $student->id]);
            }
            if ($withParents) {
                foreach ($student->parents as $parent) {
                    if ($parent->user && $parent->user->status === 'active') {
                        $people->push(['user' => $parent->user, 'role' => 'parent', 'student_id' => $student->id]);
                    }
                }
            }
        }

        // A parent of two targeted children, or a student reached twice, gets one copy.
        return $people->unique(fn ($p) => $p['user']->id)->values();
    }

    /**
     * Who would receive it: counts and a few names, for the compose screen.
     *
     * @return array{students: int, parents: int, recipients: int, sample: array<int, array{name: string, role: string}>}
     */
    public function preview(array $audience, TenantUser $sender): array
    {
        $people = $this->resolve($audience, $sender);

        return [
            'students' => $people->where('role', 'student')->count(),
            'parents' => $people->where('role', 'parent')->count(),
            'recipients' => $people->count(),
            'sample' => $people->take(8)->map(fn ($p) => ['name' => (string) $p['user']->name, 'role' => $p['role']])->values()->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data  validated: title, body, display, frequency, tone, audience, starts_at, ends_at
     */
    public function publish(array $data, TenantUser $sender): Announcement
    {
        $people = $this->resolve($data['audience'], $sender);
        if ($people->isEmpty()) {
            throw new \DomainException('EMPTY_AUDIENCE');
        }

        $announcement = DB::connection('tenant')->transaction(function () use ($data, $sender, $people) {
            $announcement = Announcement::create([
                'title' => $data['title'],
                'body' => $data['body'],
                'display' => $data['display'],
                'frequency' => $data['display'] === 'bell' ? 'once' : $data['frequency'],
                'tone' => $data['tone'] ?? 'info',
                'audience' => $data['audience'],
                'status' => 'published',
                'starts_at' => $data['starts_at'] ?? null,
                'ends_at' => $data['ends_at'] ?? null,
                'created_by' => $sender->id,
                'recipients_count' => $people->count(),
            ]);

            $now = now();
            foreach ($people->chunk(500) as $chunk) {
                AnnouncementRecipient::insert($chunk->map(fn ($p) => [
                    'id' => (string) \Illuminate\Support\Str::uuid7(),
                    'announcement_id' => $announcement->id,
                    'user_id' => $p['user']->id,
                    'role' => $p['role'],
                    'student_id' => $p['student_id'],
                    'seen_count' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->all());
            }

            return $announcement;
        });

        if ($announcement->display === 'bell') {
            $this->notifications->send(
                NotificationCatalog::ANNOUNCEMENT,
                $people->pluck('user'),
                ['title' => $announcement->title, 'body' => $announcement->body],
                null,
                $this->bellKey($announcement->id),
            );
        }

        AuditLogger::log(
            action: 'announcement.published',
            entityType: 'Announcement',
            entityId: $announcement->id,
            payload: [
                'display' => $announcement->display,
                'frequency' => $announcement->frequency,
                'target' => $data['audience']['target'],
                'recipients' => $announcement->recipients_count,
            ],
            actorType: 'staff',
            actorId: $sender->id,
        );

        return $announcement;
    }

    public function withdraw(Announcement $announcement, TenantUser $actor): Announcement
    {
        if ($announcement->status !== 'withdrawn') {
            $announcement->update(['status' => 'withdrawn', 'withdrawn_at' => now()]);
            AuditLogger::log(action: 'announcement.withdrawn', entityType: 'Announcement', entityId: $announcement->id, actorType: 'staff', actorId: $actor->id);
        }

        return $announcement;
    }

    /**
     * Banner/modal announcements this person should see now. `once` stops after they close it; `persistent` keeps
     * coming back on every sign-in until it ends or is withdrawn (the client shows it once per sign-in).
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function activeFor(TenantUser $user): Collection
    {
        return AnnouncementRecipient::query()
            ->where('user_id', $user->id)
            ->whereHas('announcement', fn ($q) => $q->live()->whereIn('display', ['banner', 'modal']))
            ->where(fn ($q) => $q->whereNull('dismissed_at')
                ->orWhereHas('announcement', fn ($a) => $a->where('frequency', 'persistent')))
            ->with('announcement')
            ->get()
            ->sortBy([
                fn ($a, $b) => ($a->announcement->display === 'modal' ? 0 : 1) <=> ($b->announcement->display === 'modal' ? 0 : 1),
                fn ($a, $b) => $b->announcement->created_at <=> $a->announcement->created_at,
            ])
            ->map(fn (AnnouncementRecipient $r) => [
                'id' => $r->announcement->id,
                'title' => $r->announcement->title,
                'body' => $r->announcement->body,
                'display' => $r->announcement->display,
                'frequency' => $r->announcement->frequency,
                'tone' => $r->announcement->tone,
                'published_at' => $r->announcement->created_at?->toIso8601String(),
                'ends_at' => $r->announcement->ends_at?->toIso8601String(),
                'dismissed_at' => $r->dismissed_at?->toIso8601String(),
            ])
            ->values();
    }

    public function markSeen(TenantUser $user, string $announcementId): bool
    {
        $recipient = AnnouncementRecipient::where('announcement_id', $announcementId)->where('user_id', $user->id)->first();
        if (! $recipient) {
            return false;
        }

        $now = now();
        $recipient->forceFill([
            'first_seen_at' => $recipient->first_seen_at ?? $now,
            'last_seen_at' => $now,
            'seen_count' => $recipient->seen_count + 1,
        ])->save();

        return true;
    }

    public function dismiss(TenantUser $user, string $announcementId): bool
    {
        $recipient = AnnouncementRecipient::where('announcement_id', $announcementId)->where('user_id', $user->id)->first();
        if (! $recipient) {
            return false;
        }

        $now = now();
        $recipient->forceFill([
            'first_seen_at' => $recipient->first_seen_at ?? $now,
            'last_seen_at' => $now,
            'seen_count' => max(1, $recipient->seen_count),
            'dismissed_at' => $now,
        ])->save();

        return true;
    }

    /** Reading a bell notification counts as having seen the announcement behind it. */
    public function markBellRead(TenantUser $user, ?string $dedupeKey): void
    {
        if ($dedupeKey && str_starts_with($dedupeKey, 'announcement:')) {
            $this->markSeen($user, substr($dedupeKey, strlen('announcement:')));
        }
    }

    public function bellKey(string $announcementId): string
    {
        return 'announcement:'.$announcementId;
    }

    /**
     * What the sender may pick from, limited by their scope.
     *
     * @return array{scope: string, targets: array<int, string>, courses: array<int, array{id: string, title: string}>, classes: array<int, array{id: string, name: string}>, grades: array<int, string>}
     */
    public function options(TenantUser $sender): array
    {
        $scope = $this->scope($sender);
        if ($scope === 'own') {
            $courses = $this->ownCourseIds($sender);

            return [
                'scope' => 'own',
                'targets' => ['courses', 'students'],
                'courses' => Course::whereIn('id', $courses)->orderBy('title')->get(['id', 'title'])->map(fn ($c) => ['id' => $c->id, 'title' => $c->title])->all(),
                'classes' => [],
                'grades' => [],
            ];
        }

        return [
            'scope' => 'tenant',
            'targets' => self::TARGETS,
            'courses' => Course::orderBy('title')->get(['id', 'title'])->map(fn ($c) => ['id' => $c->id, 'title' => $c->title])->all(),
            'classes' => SchoolClass::orderBy('name')->get(['id', 'name'])->map(fn ($c) => ['id' => $c->id, 'name' => $c->name])->all(),
            'grades' => Student::whereNotNull('grade_level')->where('grade_level', '!=', '')->distinct()->orderBy('grade_level')->pluck('grade_level')->all(),
        ];
    }

    public function scope(TenantUser $sender): string
    {
        $scope = $sender->permissionScope('notifications.send');

        return match ($scope) {
            'tenant' => 'tenant',
            'own', 'branch' => 'own',
            default => throw new AuthorizationException('No permission to send announcements.'),
        };
    }

    /** @return Collection<int, Student> */
    private function students(array $audience, TenantUser $sender): Collection
    {
        $target = $audience['target'] ?? null;
        $ids = array_values(array_filter(array_map('strval', $audience['ids'] ?? [])));
        $scope = $this->scope($sender);

        if (! in_array($target, self::TARGETS, true)) {
            throw new \InvalidArgumentException('UNKNOWN_TARGET');
        }
        if ($target !== 'all' && $ids === []) {
            return collect();
        }

        $query = Student::query()->where('status', 'active');

        if ($scope === 'own') {
            $own = $this->ownCourseIds($sender);
            if (! in_array($target, ['courses', 'students'], true)) {
                throw new AuthorizationException('Teachers can only address their own courses or students.');
            }
            if ($target === 'courses' && array_diff($ids, $own) !== []) {
                throw new AuthorizationException('Course outside your scope.');
            }
            // Either way, only students enrolled in one of the sender's courses.
            $query->whereIn('id', Enrollment::whereIn('course_id', $own)->where('status', 'active')->select('student_id'));
        }

        return match ($target) {
            'all' => $query->get(),
            'courses' => $query->whereIn('id', Enrollment::whereIn('course_id', $ids)->where('status', 'active')->select('student_id'))->get(),
            'classes' => $query->whereHas('classes', fn ($q) => $q->whereIn('classes.id', $ids))->get(),
            'grades' => $query->whereIn('grade_level', $ids)->get(),
            'students' => $query->whereIn('id', $ids)->get(),
        };
    }

    /** @return array<int, string> */
    private function ownCourseIds(TenantUser $sender): array
    {
        $staffId = $sender->staff?->id;

        return $staffId ? Course::where('teacher_staff_id', $staffId)->pluck('id')->map(fn ($id) => (string) $id)->all() : [];
    }
}
