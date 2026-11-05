<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Http\Controllers\Controller;
use App\Models\Grade;
use App\Models\OfflineAssessment;
use App\Models\OfflineAssessmentScore;
use App\Models\SchoolClass;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use App\Support\Authorization\ScopeResolver;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class OfflineAssessmentController extends Controller
{
    /**
     * List offline assessments for a class.
     */
    public function index(Request $request, string $classId): JsonResponse
    {
        $schoolClass = SchoolClass::findOrFail($classId);

        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('classes.view')) {
            throw new AuthorizationException('You do not have permission to view class details.');
        }

        if (! ScopeResolver::canAccess($user, 'classes.view', $schoolClass)) {
            throw new AuthorizationException('You are not authorized to view assessments for this class.');
        }

        $assessments = OfflineAssessment::with(['createdByStaff.user'])
            ->withCount('scores')
            ->where('class_id', $schoolClass->id)
            ->orderBy('date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return ApiResponse::success([
            'class_id' => $schoolClass->id,
            'assessments' => $assessments,
        ]);
    }

    /**
     * Create a new offline assessment for a class.
     */
    public function store(Request $request, string $classId): JsonResponse
    {
        $schoolClass = SchoolClass::findOrFail($classId);

        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('offline_assessments.manage')) {
            throw new AuthorizationException('You do not have permission to manage offline assessments.');
        }

        if (! ScopeResolver::canAccess($user, 'offline_assessments.manage', $schoolClass)) {
            throw new AuthorizationException('You can only create offline assessments for your own classes.');
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'max_score' => 'required|numeric|min:1|max:1000',
            'date' => 'nullable|date',
            'session_id' => 'nullable|uuid|exists:tenant.sessions,id',
            'description' => 'nullable|string|max:1000',
        ]);

        $assessment = $schoolClass->offlineAssessments()->create([
            'session_id' => $validated['session_id'] ?? null,
            'title' => $validated['title'],
            'max_score' => $validated['max_score'],
            'date' => $validated['date'] ?? now()->toDateString(),
            'description' => $validated['description'] ?? null,
            'created_by_staff_id' => $user->staff?->id,
        ]);

        AuditLogger::log(
            action: 'offline_assessment.created',
            entityType: 'OfflineAssessment',
            entityId: $assessment->id,
            payload: [
                'class_id' => $schoolClass->id,
                'title' => $assessment->title,
                'max_score' => $assessment->max_score,
            ]
        );

        return ApiResponse::success([
            'assessment' => $assessment->load(['createdByStaff.user']),
        ], Response::HTTP_CREATED);
    }

    /**
     * Show assessment details along with student scores.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $assessment = OfflineAssessment::with([
            'schoolClass.students.user',
            'scores.student.user',
            'createdByStaff.user',
        ])->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('classes.view')) {
            throw new AuthorizationException('You do not have permission to view class details.');
        }

        if (! ScopeResolver::canAccess($user, 'classes.view', $assessment->schoolClass)) {
            throw new AuthorizationException('You are not authorized to view this assessment.');
        }

        return ApiResponse::success([
            'assessment' => $assessment,
        ]);
    }

    /**
     * Record scores for students on an offline assessment.
     */
    public function recordScores(Request $request, string $id): JsonResponse
    {
        $assessment = OfflineAssessment::with('schoolClass')->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('offline_scores.record')) {
            throw new AuthorizationException('You do not have permission to record offline assessment scores.');
        }

        if (! ScopeResolver::canAccess($user, 'offline_scores.record', $assessment->schoolClass)) {
            throw new AuthorizationException('You can only record scores for assessments in your assigned classes.');
        }

        $validated = $request->validate([
            'scores' => 'required|array|min:1',
            'scores.*.student_id' => 'required|uuid|exists:tenant.students,id',
            'scores.*.score' => 'nullable|numeric|min:0|max:1000',
            'scores.*.is_absent' => 'nullable|boolean',
            'scores.*.notes' => 'nullable|string|max:500',
        ]);

        $recordedScores = [];

        foreach ($validated['scores'] as $item) {
            $isEnrolled = $assessment->schoolClass->students()
                ->where('students.id', $item['student_id'])
                ->exists();

            if (! $isEnrolled) {
                continue;
            }

            $scoreRecord = OfflineAssessmentScore::updateOrCreate(
                [
                    'offline_assessment_id' => $assessment->id,
                    'student_id' => $item['student_id'],
                ],
                [
                    'score' => $item['score'] ?? null,
                    'is_absent' => (bool) ($item['is_absent'] ?? false),
                    'notes' => $item['notes'] ?? null,
                    'recorded_by_staff_id' => $user->staff?->id,
                    'recorded_at' => now(),
                ]
            );

            // Sync to canonical Grade record for student transcript / parent view
            if (isset($item['score']) && $item['score'] !== null && empty($item['is_absent'])) {
                $maxScore = (float) $assessment->max_score;
                $percentage = $maxScore > 0 ? round(((float) $item['score'] / $maxScore) * 100, 2) : 0;

                Grade::updateOrCreate(
                    [
                        'student_id' => $item['student_id'],
                        'gradable_type' => 'OfflineAssessment',
                        'gradable_id' => $assessment->id,
                    ],
                    [
                        'score' => $item['score'],
                        'max_score' => $assessment->max_score,
                        'percentage' => $percentage,
                        'is_published' => true,
                        'graded_at' => now(),
                    ]
                );
            }

            $recordedScores[] = $scoreRecord;
        }

        AuditLogger::log(
            action: 'offline_scores.recorded',
            entityType: 'OfflineAssessment',
            entityId: $assessment->id,
            payload: [
                'count' => count($recordedScores),
            ]
        );

        return ApiResponse::success([
            'count' => count($recordedScores),
            'scores' => $recordedScores,
        ], Response::HTTP_OK);
    }
}
