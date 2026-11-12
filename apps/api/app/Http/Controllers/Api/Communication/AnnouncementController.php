<?php

namespace App\Http\Controllers\Api\Communication;

use App\Domain\Communication\AnnouncementService;
use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\AnnouncementRecipient;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * OD-37 (ANN-1): staff side of announcements. Route group requires `notifications.send`; the service applies its scope.
 */
class AnnouncementController extends Controller
{
    public function __construct(private readonly AnnouncementService $service) {}

    /** GET /announcements/options — what the sender may target. */
    public function options(Request $request): JsonResponse
    {
        return $this->guard(fn () => ApiResponse::success($this->service->options($this->user($request))));
    }

    /** POST /announcements/preview — counts and a few names for an audience. */
    public function preview(Request $request): JsonResponse
    {
        $audience = $this->validateAudience($request);

        return $this->guard(fn () => ApiResponse::success($this->service->preview($audience, $this->user($request))));
    }

    /** GET /announcements — sent announcements with delivery counters (scope `own` sees its own only). */
    public function index(Request $request): JsonResponse
    {
        $user = $this->user($request);

        return $this->guard(function () use ($request, $user) {
            $query = Announcement::query()
                ->with('author:id,name')
                ->withCount([
                    'recipients as seen_count' => fn ($q) => $q->whereNotNull('first_seen_at'),
                    'recipients as dismissed_count' => fn ($q) => $q->whereNotNull('dismissed_at'),
                ])
                ->orderByDesc('created_at');

            if ($this->service->scope($user) === 'own') {
                $query->where('created_by', $user->id);
            }
            if ($request->filled('status')) {
                $request->validate(['status' => Rule::in(['live', 'scheduled', 'ended', 'withdrawn'])]);
                $now = now();
                match ($request->input('status')) {
                    'live' => $query->live(),
                    'scheduled' => $query->where('status', 'published')->where('starts_at', '>', $now),
                    'ended' => $query->where('status', 'published')->whereNotNull('ends_at')->where('ends_at', '<=', $now),
                    'withdrawn' => $query->where('status', 'withdrawn'),
                };
            }

            $page = $query->paginate(min(50, max(1, (int) $request->input('per_page', 20))));

            return ApiResponse::success(
                ['announcements' => collect($page->items())->map(fn (Announcement $a) => $this->present($a))->all()],
                Response::HTTP_OK,
                ['pagination' => ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()]],
            );
        });
    }

    /** POST /announcements — validate, resolve the audience and publish. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => 'required|string|max:150',
            'body' => 'required|string|max:5000',
            'display' => ['required', Rule::in(Announcement::DISPLAYS)],
            'frequency' => ['required_unless:display,bell', 'nullable', Rule::in(Announcement::FREQUENCIES)],
            'tone' => ['nullable', Rule::in(Announcement::TONES)],
            'starts_at' => 'nullable|date|prohibited_if:display,bell',
            'ends_at' => 'nullable|date|after:now|after:starts_at',
        ]);
        $data['audience'] = $this->validateAudience($request);
        $data['frequency'] ??= 'once';

        return $this->guard(function () use ($data, $request) {
            try {
                $announcement = $this->service->publish($data, $this->user($request));
            } catch (\DomainException) {
                return ApiResponse::error('EMPTY_AUDIENCE', 'لا يوجد مستلمون لهذا الاختيار.', Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            return ApiResponse::success(['announcement' => $this->present($announcement->loadCount([
                'recipients as seen_count' => fn ($q) => $q->whereNotNull('first_seen_at'),
                'recipients as dismissed_count' => fn ($q) => $q->whereNotNull('dismissed_at'),
            ]))], Response::HTTP_CREATED);
        });
    }

    /** GET /announcements/{id}/recipients — who exactly, and what each person did. */
    public function recipients(Request $request, string $id): JsonResponse
    {
        $request->validate(['state' => ['nullable', Rule::in(['seen', 'unseen', 'dismissed'])], 'search' => 'nullable|string|max:100']);

        return $this->guard(function () use ($request, $id) {
            $announcement = $this->findVisible($request, $id);
            $query = AnnouncementRecipient::where('announcement_id', $announcement->id)
                ->with(['user:id,name,phone', 'student.user:id,name'])
                ->orderBy('role')->orderBy('created_at');

            match ($request->input('state')) {
                'seen' => $query->whereNotNull('first_seen_at'),
                'unseen' => $query->whereNull('first_seen_at'),
                'dismissed' => $query->whereNotNull('dismissed_at'),
                default => null,
            };
            if ($request->filled('search')) {
                $term = '%'.$request->input('search').'%';
                $query->whereHas('user', fn ($q) => $q->where('name', 'like', $term)->orWhere('phone', 'like', $term));
            }

            $page = $query->paginate(min(100, max(1, (int) $request->input('per_page', 25))));

            return ApiResponse::success(
                ['recipients' => collect($page->items())->map(fn (AnnouncementRecipient $r) => [
                    'id' => $r->id,
                    'name' => $r->user?->name,
                    'role' => $r->role,
                    'student_name' => $r->role === 'parent' ? $r->student?->user?->name : null,
                    'first_seen_at' => $r->first_seen_at?->toIso8601String(),
                    'last_seen_at' => $r->last_seen_at?->toIso8601String(),
                    'seen_count' => $r->seen_count,
                    'dismissed_at' => $r->dismissed_at?->toIso8601String(),
                ])->all()],
                Response::HTTP_OK,
                ['pagination' => ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()]],
            );
        });
    }

    /** POST /announcements/{id}/withdraw — stops showing it everywhere. */
    public function withdraw(Request $request, string $id): JsonResponse
    {
        return $this->guard(function () use ($request, $id) {
            $announcement = $this->service->withdraw($this->findVisible($request, $id), $this->user($request));

            return ApiResponse::success(['announcement' => $this->present($announcement)]);
        });
    }

    private function findVisible(Request $request, string $id): Announcement
    {
        $user = $this->user($request);
        $query = Announcement::query();
        if ($this->service->scope($user) === 'own') {
            $query->where('created_by', $user->id);
        }

        return $query->findOrFail($id);
    }

    /** @return array{target: string, ids: array<int, string>, students: bool, parents: bool} */
    private function validateAudience(Request $request): array
    {
        $validated = $request->validate([
            'audience' => 'required|array',
            'audience.target' => ['required', Rule::in(AnnouncementService::TARGETS)],
            'audience.ids' => 'array|max:2000|required_unless:audience.target,all',
            'audience.ids.*' => 'string|max:100',
            'audience.students' => 'boolean',
            'audience.parents' => 'boolean',
        ]);
        $audience = $validated['audience'];
        $audience['ids'] = $audience['target'] === 'all' ? [] : array_values(array_unique($audience['ids'] ?? []));
        $audience['students'] = (bool) ($audience['students'] ?? true);
        $audience['parents'] = (bool) ($audience['parents'] ?? false);

        if (! $audience['students'] && ! $audience['parents']) {
            abort(response()->json(['error' => ['code' => 'VALIDATION_ERROR', 'message' => 'اختر الطلاب أو أولياء الأمور أو كليهما.', 'details' => ['audience.students' => ['اختر الطلاب أو أولياء الأمور أو كليهما.']]]], Response::HTTP_UNPROCESSABLE_ENTITY));
        }

        return $audience;
    }

    /** @return array<string, mixed> */
    private function present(Announcement $a): array
    {
        $now = now();
        $state = match (true) {
            $a->status === 'withdrawn' => 'withdrawn',
            $a->starts_at !== null && $a->starts_at > $now => 'scheduled',
            $a->ends_at !== null && $a->ends_at <= $now => 'ended',
            default => 'live',
        };

        return [
            'id' => $a->id,
            'title' => $a->title,
            'body' => $a->body,
            'display' => $a->display,
            'frequency' => $a->frequency,
            'tone' => $a->tone,
            'audience' => $a->audience,
            'state' => $state,
            'starts_at' => $a->starts_at?->toIso8601String(),
            'ends_at' => $a->ends_at?->toIso8601String(),
            'withdrawn_at' => $a->withdrawn_at?->toIso8601String(),
            'created_at' => $a->created_at?->toIso8601String(),
            'author' => $a->relationLoaded('author') ? $a->author?->name : null,
            'recipients_count' => $a->recipients_count,
            'seen_count' => (int) ($a->seen_count ?? 0),
            'dismissed_count' => (int) ($a->dismissed_count ?? 0),
        ];
    }

    private function user(Request $request): TenantUser
    {
        /** @var TenantUser $user */
        $user = $request->user();

        return $user;
    }

    private function guard(callable $fn): JsonResponse
    {
        try {
            return $fn();
        } catch (AuthorizationException $e) {
            return ApiResponse::error('FORBIDDEN', 'لا تملك صلاحية مخاطبة هذه الفئة.', Response::HTTP_FORBIDDEN);
        } catch (\InvalidArgumentException) {
            return ApiResponse::error('VALIDATION_ERROR', 'فئة غير معروفة.', Response::HTTP_UNPROCESSABLE_ENTITY);
        }
    }
}
