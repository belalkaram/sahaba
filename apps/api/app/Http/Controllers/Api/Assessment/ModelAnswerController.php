<?php

namespace App\Http\Controllers\Api\Assessment;

use App\Domain\Assessment\Services\ModelAnswerAccess;
use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\AssignmentAnswer;
use App\Models\AssignmentSubmission;
use App\Models\Enrollment;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ModelAnswerRelease;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Model answers (the teacher's solution) of an exam or assignment.
 *
 * Teachers decide who sees them: release / revoke for one student, a whole class, or everyone, and see
 * per student whether the work is finished, graded and released. Students read them only through
 * ModelAnswerAccess (finished + grades published + released or auto-released). `{kind}` is exams|assignments.
 */
class ModelAnswerController extends Controller
{
    public function __construct(protected ModelAnswerAccess $access) {}

    /** Teacher: who finished, who is graded, who can currently see the model answers. */
    public function status(Request $request, string $courseId, string $kind, string $id): JsonResponse
    {
        [$item, $denied] = $this->resolve($request, $courseId, $kind, $id, staff: true);
        if ($denied) {
            return $denied;
        }

        $rows = Enrollment::where('course_id', $courseId)
            ->where('status', 'active')
            ->with('student.user')
            ->get()
            ->map(function ($enrollment) use ($item) {
                $student = $enrollment->student;
                if (! $student) {
                    return null;
                }
                $finished = $this->access->hasFinished($item, $student);
                $graded = $finished && $this->access->gradesPublished($item, $student);

                return [
                    'student_id' => $student->id,
                    'name' => $student->user?->name,
                    'finished' => $finished,
                    'graded' => $graded,
                    'can_view' => $this->access->check($item, $student)['allowed'],
                ];
            })
            ->filter()
            ->values();

        $releases = ModelAnswerRelease::where('assessable_type', ModelAnswerAccess::typeOf($item))
            ->where('assessable_id', $item->id)
            ->get(['id', 'scope', 'student_id', 'class_id', 'released_at']);

        return ApiResponse::success([
            'auto_release' => (bool) $item->auto_release_model_answers,
            'students' => $rows,
            'releases' => $releases,
        ]);
    }

    /** Teacher: release the model answers to a student, a class, or everyone. */
    public function release(Request $request, string $courseId, string $kind, string $id): JsonResponse
    {
        [$item, $denied] = $this->resolve($request, $courseId, $kind, $id, staff: true);
        if ($denied) {
            return $denied;
        }

        $data = $this->validateTarget($request);
        $type = ModelAnswerAccess::typeOf($item);
        /** @var TenantUser $user */
        $user = $request->user();
        $created = 0;

        foreach ($this->targets($data) as $target) {
            $exists = ModelAnswerRelease::where('assessable_type', $type)
                ->where('assessable_id', $item->id)
                ->where($target)
                ->exists();
            if (! $exists) {
                ModelAnswerRelease::create($target + [
                    'assessable_type' => $type,
                    'assessable_id' => $item->id,
                    'released_by_user_id' => $user->id,
                    'released_at' => now(),
                ]);
                $created++;
            }
        }

        return ApiResponse::success(['released' => $created], Response::HTTP_CREATED);
    }

    /** Teacher: take the model answers back. */
    public function revoke(Request $request, string $courseId, string $kind, string $id): JsonResponse
    {
        [$item, $denied] = $this->resolve($request, $courseId, $kind, $id, staff: true);
        if ($denied) {
            return $denied;
        }

        $data = $this->validateTarget($request);
        $type = ModelAnswerAccess::typeOf($item);
        $removed = 0;

        foreach ($this->targets($data) as $target) {
            $removed += ModelAnswerRelease::where('assessable_type', $type)
                ->where('assessable_id', $item->id)
                ->where($target)
                ->delete();
        }

        return ApiResponse::success(['revoked' => $removed]);
    }

    /** Teacher: switch automatic release (after the window closes) on or off. */
    public function setAutoRelease(Request $request, string $courseId, string $kind, string $id): JsonResponse
    {
        [$item, $denied] = $this->resolve($request, $courseId, $kind, $id, staff: true);
        if ($denied) {
            return $denied;
        }

        $enabled = $request->validate(['enabled' => 'required|boolean'])['enabled'];
        $item->update(['auto_release_model_answers' => $enabled]);

        return ApiResponse::success(['auto_release' => $enabled]);
    }

    /** Student (or staff preview): the questions with the model answer next to the student's own answer. */
    public function show(Request $request, string $courseId, string $kind, string $id): JsonResponse
    {
        [$item, $denied] = $this->resolve($request, $courseId, $kind, $id, staff: false);
        if ($denied) {
            return $denied;
        }

        /** @var TenantUser $user */
        $user = $request->user();
        $student = $user->student;
        $isStaff = $this->isStaff($user, $item);

        if (! $isStaff) {
            if (! $student) {
                return ApiResponse::error('NOT_A_STUDENT', 'Only students can view their model answers.', Response::HTTP_FORBIDDEN);
            }
            $decision = $this->access->check($item, $student);
            if (! $decision['allowed']) {
                return ApiResponse::error('MODEL_ANSWERS_NOT_AVAILABLE', 'Model answers are not available yet.', Response::HTTP_FORBIDDEN, ['reason' => $decision['reason']]);
            }
        }

        $questions = $item->questions()->get()->each->makeVisible(['correct_answer', 'acceptable_answers', 'model_answer', 'model_answer_image_path']);
        $answers = $student ? $this->studentAnswers($item, $student->id) : collect();

        $payload = $questions->map(function ($q) use ($answers) {
            $mine = $answers->get($q->id);

            return [
                'question_id' => $q->id,
                'question_text' => $q->question_text,
                'question_type' => $q->question_type,
                'options' => $q->options,
                'points' => $q->points,
                'has_image' => $q->has_image,
                'has_model_answer_image' => ! empty($q->model_answer_image_path),
                'correct_answer' => $q->getRawOriginal('correct_answer'),
                'model_answer' => $q->model_answer,
                'explanation' => $q->explanation,
                'student_answer' => $mine?->answer_text,
                'selected_options' => $mine?->selected_options,
                'is_correct' => $mine?->is_correct,
                'awarded_points' => $mine?->awarded_points,
                'feedback' => $mine?->feedback,
            ];
        });

        return ApiResponse::success(['title' => $item->title, 'questions' => $payload]);
    }

    /** @return array{0: Exam|Assignment|null, 1: JsonResponse|null} */
    private function resolve(Request $request, string $courseId, string $kind, string $id, bool $staff): array
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $item = match ($kind) {
            'exams' => Exam::where('course_id', $courseId)->findOrFail($id),
            'assignments' => Assignment::where('course_id', $courseId)->findOrFail($id),
            default => null,
        };
        if (! $item) {
            return [null, ApiResponse::error('NOT_FOUND', 'Unknown resource.', Response::HTTP_NOT_FOUND)];
        }

        if ($staff && ! $this->isStaff($user, $item)) {
            return [null, ApiResponse::error('FORBIDDEN', 'You are not allowed to manage model answers.', Response::HTTP_FORBIDDEN)];
        }

        return [$item, null];
    }

    private function isStaff(?TenantUser $user, Exam|Assignment $item): bool
    {
        $permission = $item instanceof Exam ? 'exams.grade' : 'assignments.grade';

        return (bool) $user?->hasPermissionTo($permission);
    }

    /** @return array{scope: string, student_ids?: array<int, string>, class_id?: string} */
    private function validateTarget(Request $request): array
    {
        return $request->validate([
            'scope' => 'required|in:student,class,all',
            'student_ids' => 'required_if:scope,student|array|min:1',
            'student_ids.*' => 'uuid|exists:tenant.students,id',
            'class_id' => 'required_if:scope,class|uuid|exists:tenant.classes,id',
        ]);
    }

    /** @return array<int, array<string, mixed>> release rows (without the assessable columns) for the target */
    private function targets(array $data): array
    {
        return match ($data['scope']) {
            'all' => [['scope' => 'all', 'student_id' => null, 'class_id' => null]],
            'class' => [['scope' => 'class', 'student_id' => null, 'class_id' => $data['class_id']]],
            default => array_map(
                fn ($sid) => ['scope' => 'student', 'student_id' => $sid, 'class_id' => null],
                $data['student_ids']
            ),
        };
    }

    /** The student's answers from their latest finished attempt / submission, keyed by question id. */
    private function studentAnswers(Exam|Assignment $item, string $studentId)
    {
        if ($item instanceof Exam) {
            $attempt = ExamAttempt::where('exam_id', $item->id)->where('student_id', $studentId)
                ->where('status', '!=', 'in_progress')->latest('attempt_number')->with('answers')->first();

            return $attempt ? $attempt->answers->keyBy('question_id') : collect();
        }

        $submission = AssignmentSubmission::where('assignment_id', $item->id)->where('student_id', $studentId)
            ->latest('attempt_number')->first();

        return $submission
            ? AssignmentAnswer::where('submission_id', $submission->id)->get()->keyBy('question_id')
            : collect();
    }
}
