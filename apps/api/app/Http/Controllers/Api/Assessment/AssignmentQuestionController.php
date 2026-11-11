<?php

namespace App\Http\Controllers\Api\Assessment;

use App\Domain\Assessment\Services\AssignmentAnswerService;
use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\AssignmentAnswer;
use App\Models\AssignmentQuestion;
use App\Models\AssignmentSubmission;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Questions inside an assignment (multiple choice / true-false / short answer / essay, each with an optional
 * image) and the teacher's grading of the students' answers. Students answer through AssignmentController::submit.
 */
class AssignmentQuestionController extends Controller
{
    public function __construct(protected AssignmentAnswerService $answers) {}

    private const RULES = [
        'question_text' => 'required|string',
        'question_type' => 'nullable|string|in:multiple_choice,multiple_select,true_false,short_answer,essay',
        'points' => 'nullable|numeric|min:0',
        'options' => 'nullable|array',
        'correct_answer' => 'nullable|string',
        'acceptable_answers' => 'nullable|array',
        'explanation' => 'nullable|string',
        'model_answer' => 'nullable|string',
        'sort_order' => 'nullable|integer',
    ];

    public function index(Request $request, string $courseId, string $id): JsonResponse
    {
        $assignment = Assignment::where('course_id', $courseId)->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();
        $isStaff = $this->isStaff($user);

        // Students never see an unpublished assignment's questions.
        if (! $isStaff && $assignment->status !== 'published') {
            return ApiResponse::error('NOT_FOUND', 'Assignment not found.', Response::HTTP_NOT_FOUND);
        }

        $questions = $assignment->questions()->get();
        if ($isStaff && $request->boolean('with_answers')) {
            $questions->each->makeVisible(['correct_answer', 'acceptable_answers', 'model_answer']);
        }

        return ApiResponse::success(['questions' => $questions]);
    }

    public function store(Request $request, string $courseId, string $id): JsonResponse
    {
        $assignment = Assignment::where('course_id', $courseId)->findOrFail($id);
        $v = $request->validate(self::RULES);

        $question = $assignment->questions()->create([
            'question_text' => $v['question_text'],
            'question_type' => $v['question_type'] ?? 'multiple_choice',
            'points' => $v['points'] ?? 10.00,
            'options' => $v['options'] ?? null,
            'correct_answer' => $v['correct_answer'] ?? null,
            'acceptable_answers' => $v['acceptable_answers'] ?? null,
            'explanation' => $v['explanation'] ?? null,
            'model_answer' => $v['model_answer'] ?? null,
            'sort_order' => $v['sort_order'] ?? (($assignment->questions()->max('sort_order') ?? 0) + 1),
        ]);

        $this->syncPoints($assignment);

        return ApiResponse::success(['question' => $question->makeVisible(['correct_answer', 'acceptable_answers', 'model_answer'])], Response::HTTP_CREATED);
    }

    public function update(Request $request, string $courseId, string $id, string $questionId): JsonResponse
    {
        $assignment = Assignment::where('course_id', $courseId)->findOrFail($id);
        $question = AssignmentQuestion::where('assignment_id', $assignment->id)->findOrFail($questionId);

        $rules = self::RULES;
        $rules['question_text'] = 'sometimes|required|string';
        $question->update($request->validate($rules));
        $this->syncPoints($assignment);

        return ApiResponse::success(['question' => $question->fresh()->makeVisible(['correct_answer', 'acceptable_answers', 'model_answer'])]);
    }

    public function destroy(string $courseId, string $id, string $questionId): JsonResponse
    {
        $assignment = Assignment::where('course_id', $courseId)->findOrFail($id);
        AssignmentQuestion::where('assignment_id', $assignment->id)->findOrFail($questionId)->delete();
        $this->syncPoints($assignment);

        return ApiResponse::success(['message' => 'Question deleted successfully.']);
    }

    /** Teacher: one submission's answers with the questions (answers visible) for grading. */
    public function submissionAnswers(string $courseId, string $id, string $submissionId): JsonResponse
    {
        $assignment = Assignment::where('course_id', $courseId)->findOrFail($id);
        $submission = AssignmentSubmission::where('assignment_id', $assignment->id)->findOrFail($submissionId);

        $answers = AssignmentAnswer::where('submission_id', $submission->id)->with('question')->get()
            ->each(fn ($a) => $a->question?->makeVisible(['correct_answer', 'acceptable_answers', 'model_answer']));

        return ApiResponse::success(['submission' => $submission, 'answers' => $answers]);
    }

    /** Teacher: grade one (typically essay) answer; the submission score is recomputed from all its answers. */
    public function gradeAnswer(Request $request, string $courseId, string $id, string $submissionId, string $answerId): JsonResponse
    {
        $assignment = Assignment::where('course_id', $courseId)->findOrFail($id);
        $submission = AssignmentSubmission::where('assignment_id', $assignment->id)->findOrFail($submissionId);
        $answer = AssignmentAnswer::where('submission_id', $submission->id)->with('question')->findOrFail($answerId);

        $v = $request->validate([
            'awarded_points' => 'required|numeric|min:0|max:'.(float) $answer->question->points,
            'feedback' => 'nullable|string',
        ]);

        $answer->update([
            'awarded_points' => $v['awarded_points'],
            'is_correct' => (float) $v['awarded_points'] >= (float) $answer->question->points,
            'feedback' => $v['feedback'] ?? $answer->feedback,
        ]);

        $this->answers->recompute($submission, $request->user());

        return ApiResponse::success(['answer' => $answer->fresh(), 'submission' => $submission->fresh()]);
    }

    /** Questions define the assignment's total points once it has any. */
    private function syncPoints(Assignment $assignment): void
    {
        $total = $assignment->questions()->sum('points');
        if ($total > 0) {
            $assignment->update(['points_possible' => $total]);
        }
    }

    private function isStaff(?TenantUser $user): bool
    {
        return (bool) ($user?->hasPermissionTo('assignments.create') || $user?->hasPermissionTo('assignments.grade'));
    }
}
