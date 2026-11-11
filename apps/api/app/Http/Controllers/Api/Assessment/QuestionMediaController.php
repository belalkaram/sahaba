<?php

namespace App\Http\Controllers\Api\Assessment;

use App\Domain\Assessment\Services\ModelAnswerAccess;
use App\Domain\Media\Services\ProfileImageService;
use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\AssignmentQuestion;
use App\Models\Enrollment;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Question;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Optional image on a question (and on its model answer), for exam and assignment questions alike.
 * Files sit on the private per-tenant disk and are served only through here, with the same visibility
 * rules as the content they belong to. `{kind}` is exams|assignments; `variant` is question|model_answer.
 */
class QuestionMediaController extends Controller
{
    public function __construct(
        protected ProfileImageService $images,
        protected TenantContext $context,
        protected ModelAnswerAccess $access
    ) {}

    public function store(Request $request, string $courseId, string $kind, string $id, string $questionId): JsonResponse
    {
        [$item, $question] = $this->load($courseId, $kind, $id, $questionId);
        if (! $this->canManage($request->user(), $item)) {
            return ApiResponse::error('FORBIDDEN', 'You are not allowed to edit this content.', Response::HTTP_FORBIDDEN);
        }

        $request->validate([
            'image' => 'required|file|image|mimes:'.ProfileImageService::MIMES.'|max:'.ProfileImageService::MAX_KB,
            'variant' => 'nullable|in:question,model_answer',
        ]);

        $column = $this->column($request->input('variant'));
        $slug = $this->context->getTenantOrFail()->slug;
        $question->update([$column => $this->images->store($request->file('image'), $slug, 'questions', $question->getRawOriginal($column))]);

        return ApiResponse::success(['question' => $this->staffView($question->fresh())]);
    }

    public function destroy(Request $request, string $courseId, string $kind, string $id, string $questionId): JsonResponse
    {
        [$item, $question] = $this->load($courseId, $kind, $id, $questionId);
        if (! $this->canManage($request->user(), $item)) {
            return ApiResponse::error('FORBIDDEN', 'You are not allowed to edit this content.', Response::HTTP_FORBIDDEN);
        }

        $column = $this->column($request->query('variant'));
        $this->images->delete($question->getRawOriginal($column), $this->context->getTenantOrFail()->slug);
        $question->update([$column => null]);

        return ApiResponse::success(['question' => $this->staffView($question->fresh())]);
    }

    public function show(Request $request, string $courseId, string $kind, string $id, string $questionId)
    {
        [$item, $question] = $this->load($courseId, $kind, $id, $questionId);

        /** @var TenantUser $user */
        $user = $request->user();
        $variant = $request->query('variant') === 'model_answer' ? 'model_answer' : 'question';

        if (! $this->canManage($user, $item) && ! $this->canViewAsStudent($user, $item, $variant)) {
            return ApiResponse::error('FORBIDDEN', 'You cannot view this image.', Response::HTTP_FORBIDDEN);
        }

        return $this->images->response($question->getRawOriginal($this->column($variant)), $this->context->getTenantOrFail()->slug, private: true)
            ?? ApiResponse::error('IMAGE_NOT_FOUND', 'No image.', Response::HTTP_NOT_FOUND);
    }

    /** @return array{0: Exam|Assignment, 1: Question|AssignmentQuestion} */
    private function load(string $courseId, string $kind, string $id, string $questionId): array
    {
        if ($kind === 'exams') {
            $item = Exam::where('course_id', $courseId)->findOrFail($id);

            return [$item, Question::where('exam_id', $item->id)->findOrFail($questionId)];
        }

        $item = Assignment::where('course_id', $courseId)->findOrFail($id);

        return [$item, AssignmentQuestion::where('assignment_id', $item->id)->findOrFail($questionId)];
    }

    private function column(?string $variant): string
    {
        return $variant === 'model_answer' ? 'model_answer_image_path' : 'image_path';
    }

    private function canManage(?TenantUser $user, Exam|Assignment $item): bool
    {
        $prefix = $item instanceof Exam ? 'exams' : 'assignments';

        return (bool) ($user?->hasPermissionTo($prefix.'.create') || $user?->hasPermissionTo($prefix.'.grade'));
    }

    private function canViewAsStudent(?TenantUser $user, Exam|Assignment $item, string $variant): bool
    {
        $student = $user?->student;
        if (! $student) {
            return false;
        }

        if ($variant === 'model_answer') {
            return $this->access->check($item, $student)['allowed'];
        }

        // The question image is part of the question: visible to a student who may see the questions at all.
        $enrolled = Enrollment::where('course_id', $item->course_id)->where('student_id', $student->id)->where('status', 'active')->exists();
        if (! $enrolled) {
            return false;
        }

        if ($item instanceof Exam) {
            return ExamAttempt::where('exam_id', $item->id)->where('student_id', $student->id)->exists();
        }

        return $item->status === 'published';
    }

    /** Staff-facing question JSON (answers visible, storage paths still hidden). */
    private function staffView(Question|AssignmentQuestion $question): Question|AssignmentQuestion
    {
        return $question->makeVisible(['correct_answer', 'acceptable_answers', 'model_answer']);
    }
}
