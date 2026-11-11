<?php

namespace App\Http\Controllers\Api\Assessment;

use App\Domain\Assessment\Services\AssignmentAnswerService;
use App\Domain\Communication\NotificationService;
use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\Course;
use App\Models\Grade;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

class AssignmentController extends Controller
{
    /**
     * List assignments of a course.
     */
    public function index(string $courseId): JsonResponse
    {
        $course = Course::findOrFail($courseId);
        $assignments = $course->assignments()->with('lesson')->latest()->get();

        return ApiResponse::success(['assignments' => $assignments]);
    }

    /**
     * Create an assignment.
     */
    public function store(Request $request, string $courseId): JsonResponse
    {
        $course = Course::findOrFail($courseId);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'lesson_id' => 'nullable|uuid|exists:tenant.lessons,id',
            'description' => 'nullable|string',
            'points_possible' => 'nullable|numeric|min:0',
            'due_at' => 'nullable|date',
            'allow_late' => 'nullable|boolean',
            'late_penalty_percent' => 'nullable|integer|min:0|max:100',
            'allow_resubmission' => 'nullable|boolean',
            'max_file_size_mb' => 'nullable|integer|min:1|max:100',
            'allowed_file_types' => 'nullable|string',
            'auto_release_model_answers' => 'nullable|boolean',
            'status' => 'nullable|string|in:draft,published,archived',
        ]);

        $assignment = $course->assignments()->create([
            'lesson_id' => $validated['lesson_id'] ?? null,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'points_possible' => $validated['points_possible'] ?? 100.00,
            'due_at' => $validated['due_at'] ?? null,
            'allow_late' => $validated['allow_late'] ?? true,
            'late_penalty_percent' => $validated['late_penalty_percent'] ?? 0,
            'allow_resubmission' => $validated['allow_resubmission'] ?? false,
            'max_file_size_mb' => $validated['max_file_size_mb'] ?? 20,
            'allowed_file_types' => $validated['allowed_file_types'] ?? 'pdf,doc,docx,zip,png,jpg',
            'auto_release_model_answers' => $validated['auto_release_model_answers'] ?? false,
            'status' => $validated['status'] ?? 'published',
        ]);

        return ApiResponse::success(['assignment' => $assignment], Response::HTTP_CREATED);
    }

    /**
     * Show an assignment.
     */
    public function show(Request $request, string $courseId, string $id): JsonResponse
    {
        $assignment = Assignment::where('course_id', $courseId)->with('lesson')->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();

        $data = ['assignment' => $assignment];

        if ($user?->student) {
            $submission = AssignmentSubmission::where('assignment_id', $assignment->id)
                ->where('student_id', $user->student->id)
                ->latest('attempt_number')
                ->first();
            $data['student_submission'] = $submission;
        }

        return ApiResponse::success($data);
    }

    /**
     * Update an assignment.
     */
    public function update(Request $request, string $courseId, string $id): JsonResponse
    {
        $assignment = Assignment::where('course_id', $courseId)->findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'lesson_id' => 'nullable|uuid|exists:tenant.lessons,id',
            'description' => 'nullable|string',
            'points_possible' => 'nullable|numeric|min:0',
            'due_at' => 'nullable|date',
            'allow_late' => 'nullable|boolean',
            'late_penalty_percent' => 'nullable|integer|min:0|max:100',
            'allow_resubmission' => 'nullable|boolean',
            'max_file_size_mb' => 'nullable|integer|min:1|max:100',
            'allowed_file_types' => 'nullable|string',
            'auto_release_model_answers' => 'nullable|boolean',
            'status' => 'nullable|string|in:draft,published,archived',
        ]);

        $assignment->update($validated);

        return ApiResponse::success(['assignment' => $assignment]);
    }

    /**
     * Delete an assignment.
     */
    public function destroy(string $courseId, string $id): JsonResponse
    {
        $assignment = Assignment::where('course_id', $courseId)->findOrFail($id);
        $assignment->delete();

        return ApiResponse::success(['message' => 'Assignment deleted successfully.']);
    }

    /**
     * List submissions for an assignment (Teacher/Staff).
     */
    public function submissions(string $courseId, string $id): JsonResponse
    {
        $assignment = Assignment::where('course_id', $courseId)->findOrFail($id);
        $submissions = AssignmentSubmission::where('assignment_id', $assignment->id)
            ->with(['student.user', 'gradedBy'])
            ->latest('submitted_at')
            ->get();

        return ApiResponse::success(['submissions' => $submissions]);
    }

    /**
     * Submit an assignment as a student (supports text content and file upload).
     *
     * R6-4: File upload, due date enforcement, late penalty flags, resubmission policy.
     */
    public function submit(Request $request, string $courseId, string $id): JsonResponse
    {
        $assignment = Assignment::where('course_id', $courseId)->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->student) {
            return ApiResponse::error(
                'NOT_A_STUDENT',
                'Only authenticated students can submit assignments.',
                Response::HTTP_FORBIDDEN
            );
        }

        $studentId = $user->student->id;

        // Check if submission already exists
        $existing = AssignmentSubmission::where('assignment_id', $assignment->id)
            ->where('student_id', $studentId)
            ->latest('attempt_number')
            ->first();

        if ($existing && ! $assignment->allow_resubmission) {
            return ApiResponse::error(
                'DUPLICATE_SUBMISSION',
                'An assignment submission already exists for this student.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        // Due date & late submission policy
        $isLate = false;
        if ($assignment->isPastDue()) {
            if (! $assignment->allow_late) {
                return ApiResponse::error(
                    'PAST_DUE',
                    'The deadline for this assignment has passed and late submissions are not allowed.',
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }
            $isLate = true;
        }

        $maxSizeKb = ($assignment->max_file_size_mb ?: 20) * 1024;

        // Multipart requests (with a file) carry the answers as a JSON string.
        if (is_string($request->input('answers'))) {
            $request->merge(['answers' => json_decode($request->input('answers'), true) ?: []]);
        }

        $validated = $request->validate([
            'content' => 'nullable|string',
            'file' => 'nullable|file|max:'.$maxSizeKb,
            'answers' => 'nullable|array',
            'answers.*.question_id' => 'required|uuid|exists:tenant.assignment_questions,id',
            'answers.*.answer_text' => 'nullable|string',
            'answers.*.selected_options' => 'nullable|array',
        ]);

        if (empty($validated['content']) && ! $request->hasFile('file') && empty($validated['answers'])) {
            return ApiResponse::error(
                'EMPTY_SUBMISSION',
                'Please provide either written content or an attached file.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $filePath = null;
        $fileName = null;
        $fileSize = null;
        $mimeType = null;

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $allowedExtensions = array_map('trim', explode(',', strtolower($assignment->allowed_file_types ?: 'pdf,doc,docx,zip,png,jpg')));
            $ext = strtolower($file->getClientOriginalExtension());

            if (! in_array($ext, $allowedExtensions, true)) {
                return ApiResponse::error(
                    'INVALID_FILE_TYPE',
                    "File type .{$ext} is not allowed. Allowed types: {$assignment->allowed_file_types}",
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }

            $fileName = $file->getClientOriginalName();
            $fileSize = $file->getSize();
            $mimeType = $file->getClientMimeType();

            $storageDir = 'assignments/'.$assignment->id;
            $safeName = Str::uuid().'.'.$ext;
            $filePath = $file->storeAs($storageDir, $safeName, 'tenant_private');
        }

        $attemptNumber = $existing ? ($existing->attempt_number + 1) : 1;

        $submission = AssignmentSubmission::create([
            'assignment_id' => $assignment->id,
            'student_id' => $studentId,
            'attempt_number' => $attemptNumber,
            'content' => $validated['content'] ?? null,
            'file_path' => $filePath,
            'file_name' => $fileName,
            'file_size' => $fileSize,
            'mime_type' => $mimeType,
            'submitted_at' => now(),
            'is_late' => $isLate,
            'status' => 'submitted',
        ]);

        if (! empty($validated['answers'])) {
            app(AssignmentAnswerService::class)->record($submission, $assignment, $validated['answers']);
        }

        return ApiResponse::success([
            'submission' => $submission->fresh()->load(['student.user', 'assignment']),
            'message' => 'Assignment submitted successfully.',
        ], Response::HTTP_CREATED);
    }

    /**
     * Download or stream attached submission file (signed/scoped).
     */
    public function downloadFile(Request $request, string $courseId, string $id, string $submissionId): BinaryFileResponse|JsonResponse
    {
        $assignment = Assignment::where('course_id', $courseId)->findOrFail($id);
        $submission = AssignmentSubmission::where('assignment_id', $assignment->id)->findOrFail($submissionId);

        /** @var TenantUser $user */
        $user = $request->user();
        $isStaff = $user?->hasPermissionTo('assignments.grade') || $user?->hasPermissionTo('assignments.create');

        if (! $isStaff && $submission->student_id !== $user->student?->id) {
            return ApiResponse::error('FORBIDDEN', 'You do not have permission to view this submission file.', Response::HTTP_FORBIDDEN);
        }

        if (empty($submission->file_path) || ! Storage::disk('tenant_private')->exists($submission->file_path)) {
            return ApiResponse::error('FILE_NOT_FOUND', 'The requested file could not be found.', Response::HTTP_NOT_FOUND);
        }

        $fullPath = Storage::disk('tenant_private')->path($submission->file_path);

        return response()->download($fullPath, $submission->file_name ?: 'submission-file');
    }

    /**
     * Grade an assignment submission.
     */
    public function grade(Request $request, string $courseId, string $id, string $submissionId): JsonResponse
    {
        $assignment = Assignment::where('course_id', $courseId)->findOrFail($id);
        $submission = AssignmentSubmission::where('assignment_id', $assignment->id)->findOrFail($submissionId);

        /** @var TenantUser $user */
        $user = $request->user();

        $validated = $request->validate([
            'score' => 'required|numeric|min:0|max:'.$assignment->points_possible,
            'feedback' => 'nullable|string',
            'is_grade_published' => 'nullable|boolean',
        ]);

        $score = $validated['score'];

        // Apply late penalty if applicable
        if ($submission->is_late && $assignment->late_penalty_percent > 0) {
            $penalty = ($assignment->points_possible * $assignment->late_penalty_percent) / 100;
            $score = max(0, $score - $penalty);
        }

        $isPublished = $validated['is_grade_published'] ?? false;

        $submission->update([
            'score' => $score,
            'feedback' => $validated['feedback'] ?? null,
            'graded_by_user_id' => $user->id,
            'graded_at' => now(),
            'is_grade_published' => $isPublished,
            'status' => 'graded',
        ]);

        $maxScore = $assignment->points_possible > 0 ? $assignment->points_possible : 100.00;
        $percentage = round(($score / $maxScore) * 100, 2);

        Grade::updateOrCreate(
            [
                'student_id' => $submission->student_id,
                'gradable_type' => 'assignment',
                'gradable_id' => $assignment->id,
            ],
            [
                'score' => $score,
                'max_score' => $maxScore,
                'percentage' => $percentage,
                'is_published' => $isPublished,
                'graded_at' => now(),
            ]
        );

        return ApiResponse::success([
            'submission' => $submission->fresh(['student.user', 'gradedBy']),
        ]);
    }

    /**
     * Publish grades for an assignment.
     */
    public function publishGrades(string $courseId, string $id): JsonResponse
    {
        $assignment = Assignment::where('course_id', $courseId)->findOrFail($id);

        $assignment->submissions()->update(['is_grade_published' => true]);

        $newlyPublished = Grade::where('gradable_type', 'assignment')
            ->where('gradable_id', $assignment->id)
            ->where('is_published', false)
            ->pluck('student_id');

        Grade::where('gradable_type', 'assignment')
            ->where('gradable_id', $assignment->id)
            ->update(['is_published' => true]);

        app(NotificationService::class)->gradesPublished($newlyPublished, $assignment->title);

        return ApiResponse::success([
            'message' => 'Grades published successfully for assignment.',
        ]);
    }
}
