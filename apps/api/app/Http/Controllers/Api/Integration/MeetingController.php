<?php

namespace App\Http\Controllers\Api\Integration;

use App\Domain\Billing\Services\ContentAccessPolicy;
use App\Domain\Integrations\DTOs\MeetingRequest;
use App\Domain\Integrations\Exceptions\ProviderException;
use App\Domain\Integrations\Exceptions\ProviderTimeoutException;
use App\Domain\Integrations\Meetings\MeetingProviderManager;
use App\Http\Controllers\Controller;
use App\Models\ClassSession;
use App\Models\Enrollment;
use App\Models\Meeting;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class MeetingController extends Controller
{
    /** Never returned to students or parents outside the join endpoint. */
    private const PRIVATE_FIELDS = ['join_url', 'host_url', 'passcode', 'metadata', 'idempotency_key'];

    /**
     * List scheduled or active meetings.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Meeting::query()->with(['course', 'session', 'host']);

        if ($request->has('course_id')) {
            $query->where('course_id', $request->query('course_id'));
        }

        if ($request->has('session_id')) {
            $query->where('session_id', $request->query('session_id'));
        }

        if ($request->has('status')) {
            $query->where('status', $request->query('status'));
        }

        /** @var TenantUser $user */
        $user = $request->user();
        $isStaff = $this->isStaff($user);

        if (! $isStaff) {
            $this->limitToOwnMeetings($query, $user);
        }

        $meetings = $query->orderBy('start_time', 'asc')->get();

        // Links are issued by the join endpoint, after the access check.
        if (! $isStaff) {
            $meetings->each(fn (Meeting $meeting) => $meeting->makeHidden(self::PRIVATE_FIELDS));
        }

        return ApiResponse::success(['meetings' => $meetings]);
    }

    /**
     * Create a new remote meeting.
     */
    public function store(Request $request, MeetingProviderManager $providerManager): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'provider' => ['nullable', 'string', Rule::in($this->allowedProviders())],
            'start_time' => 'nullable|date',
            'duration_minutes' => 'nullable|integer|min:5|max:480',
            'idempotency_key' => 'nullable|string|max:128',
            'course_id' => 'nullable|uuid|exists:tenant.courses,id',
            'session_id' => 'nullable|uuid|exists:tenant.sessions,id',
            'host_staff_id' => 'nullable|uuid|exists:tenant.staff,id',
            'meeting_code' => 'nullable|string|max:255',
            'meet_url' => 'nullable|string|max:500',
            'settings' => 'nullable|array',
            'enable_failover' => 'nullable|boolean',
        ]);

        // Idempotency check
        if (! empty($validated['idempotency_key'])) {
            $existing = Meeting::where('idempotency_key', $validated['idempotency_key'])->first();
            if ($existing) {
                return ApiResponse::success([
                    'meeting' => $existing,
                    'idempotent' => true,
                ], Response::HTTP_OK);
            }
        }

        if (! empty($validated['meeting_code']) || ! empty($validated['meet_url'])) {
            $validated['settings'] = array_merge($validated['settings'] ?? [], [
                'meeting_code' => $validated['meeting_code'] ?? null,
                'meet_url' => $validated['meet_url'] ?? null,
            ]);
        }

        $meetingRequest = MeetingRequest::fromArray($validated);
        $hasLink = ! empty($validated['meeting_code']) || ! empty($validated['meet_url']);
        $requested = $validated['provider'] ?? 'manual';

        // A pasted link is always a manual meeting, whatever provider was asked for (OD-5).
        $providerName = $hasLink ? 'manual' : $requested;
        $enableFailover = $this->simulatedProvidersAllowed() && ($validated['enable_failover'] ?? false);

        if ($providerName === 'google_meet') {
            return ApiResponse::error(
                'GOOGLE_NOT_CONNECTED',
                'حساب Google غير مربوط بعد. الصق رابط الاجتماع يدوياً.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        if ($providerName === 'manual' && ! $hasLink) {
            return ApiResponse::error(
                'MEETING_LINK_REQUIRED',
                'أدخل رابط الاجتماع.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        try {
            if ($enableFailover) {
                $priority = [$providerName];
                if ($providerName !== 'mock') {
                    $priority[] = 'mock';
                }
                $response = $providerManager->createMeetingWithFailover($meetingRequest, $priority);
            } else {
                $provider = $providerManager->provider($providerName);
                $response = $provider->createMeeting($meetingRequest);
            }
        } catch (ProviderTimeoutException $e) {
            return ApiResponse::error('PROVIDER_TIMEOUT', $e->getMessage(), Response::HTTP_GATEWAY_TIMEOUT);
        } catch (ProviderException $e) {
            return ApiResponse::error('PROVIDER_ERROR', $e->getMessage(), Response::HTTP_BAD_GATEWAY);
        }

        $meeting = Meeting::create([
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'provider' => $response->provider,
            'external_meeting_id' => $response->externalMeetingId,
            'join_url' => $response->joinUrl,
            'host_url' => $response->hostUrl,
            'passcode' => $response->passcode,
            'idempotency_key' => $validated['idempotency_key'] ?? null,
            'start_time' => $meetingRequest->startTime,
            'duration_minutes' => $meetingRequest->durationMinutes,
            'status' => 'scheduled',
            'course_id' => $validated['course_id'] ?? null,
            'session_id' => $validated['session_id'] ?? null,
            'host_staff_id' => $validated['host_staff_id'] ?? null,
            'metadata' => $response->rawPayload,
        ]);

        return ApiResponse::success(['meeting' => $meeting], Response::HTTP_CREATED);
    }

    /**
     * Show meeting details.
     */
    public function show(string $id): JsonResponse
    {
        $meeting = Meeting::with(['course', 'session', 'host'])->findOrFail($id);

        if (! $this->isStaff(request()->user())) {
            $meeting->makeHidden(self::PRIVATE_FIELDS);
        }

        return ApiResponse::success(['meeting' => $meeting]);
    }

    /**
     * Get dynamic join URL for the meeting.
     */
    public function joinUrl(Request $request, string $id, MeetingProviderManager $providerManager, ContentAccessPolicy $policy): JsonResponse
    {
        $meeting = Meeting::with('course')->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();
        $isStaff = $this->isStaff($user);

        if ($meeting->status === 'cancelled') {
            return ApiResponse::error('MEETING_CANCELLED', 'تم إلغاء هذه الحصة.', Response::HTTP_CONFLICT);
        }

        $decision = $policy->canJoinMeeting($user, $meeting);
        if (! $decision->allowed) {
            return ApiResponse::error('MEETING_ACCESS_DENIED', 'ليس لديك صلاحية دخول هذه الحصة.', Response::HTTP_FORBIDDEN);
        }

        if (! $isStaff && ! $this->withinJoinWindow($meeting)) {
            return ApiResponse::error('MEETING_NOT_OPEN', 'لم يحن موعد الدخول إلى هذه الحصة بعد أو انتهى.', Response::HTTP_FORBIDDEN);
        }

        // Manual links are stored as given; simulated providers exist only in tests.
        $joinUrl = $meeting->provider === 'manual'
            ? $meeting->join_url
            : $providerManager->provider($meeting->provider)->getJoinUrl($meeting->external_meeting_id, ['role' => $isStaff ? 'host' : 'attendee']);

        return ApiResponse::success([
            'meeting_id' => $meeting->id,
            'external_meeting_id' => $meeting->external_meeting_id,
            'provider' => $meeting->provider,
            'join_url' => $joinUrl,
            'passcode' => $meeting->passcode,
            'status' => $meeting->status,
        ]);
    }

    /**
     * Cancel scheduled meeting.
     */
    public function cancel(string $id, MeetingProviderManager $providerManager): JsonResponse
    {
        $meeting = Meeting::findOrFail($id);

        try {
            $provider = $providerManager->provider($meeting->provider);
            $provider->cancelMeeting($meeting->external_meeting_id);
        } catch (\Throwable) {
            // Log provider failure but proceed to cancel internal record
        }

        $meeting->update(['status' => 'cancelled']);

        return ApiResponse::success([
            'meeting' => $meeting,
            'message' => 'Meeting cancelled successfully.',
        ]);
    }

    /**
     * Mock and Zoom providers fabricate links, so they are only available to automated tests.
     */
    private function simulatedProvidersAllowed(): bool
    {
        return app()->environment('testing');
    }

    /**
     * @return array<int, string>
     */
    private function allowedProviders(): array
    {
        return $this->simulatedProvidersAllowed()
            ? ['manual', 'google_meet', 'zoom', 'mock']
            : ['manual', 'google_meet'];
    }

    private function isStaff(?TenantUser $user): bool
    {
        return $user !== null && ($user->staff !== null || $user->type === 'staff' || $user->hasPermissionTo('meetings.manage'));
    }

    /**
     * Students see their enrolled courses and classes; parents their children's.
     */
    private function limitToOwnMeetings(Builder $query, TenantUser $user): void
    {
        $studentIds = collect([$user->student?->id])
            ->merge($user->parentProfile?->students()->pluck('students.id') ?? [])
            ->filter();

        $courseIds = Enrollment::whereIn('student_id', $studentIds)->where('status', 'active')->pluck('course_id');
        $sessionIds = ClassSession::whereHas('schoolClass.students', fn ($q) => $q->whereIn('students.id', $studentIds))->pluck('id');

        $query->where(function ($q) use ($courseIds, $sessionIds) {
            $q->whereIn('course_id', $courseIds)
                ->orWhereIn('session_id', $sessionIds)
                ->orWhere(fn ($open) => $open->whereNull('course_id')->whereNull('session_id'));
        });
    }

    private function withinJoinWindow(Meeting $meeting): bool
    {
        if (! $meeting->start_time) {
            return true;
        }

        $start = Carbon::parse($meeting->start_time);
        $grace = (int) config('services.meetings.join_window_minutes', 15);

        return now()->between(
            $start->copy()->subMinutes($grace),
            $start->copy()->addMinutes(($meeting->duration_minutes ?? 60) + $grace)
        );
    }
}
