<?php

namespace App\Domain\Assessment\Services;

use App\Models\Assignment;
use App\Models\AssignmentAnswer;
use App\Models\AssignmentSubmission;
use App\Models\TenantUser;

/** Stores a student's answers to assignment questions, auto-grades what it can and keeps the score in step. */
class AssignmentAnswerService
{
    public function __construct(protected QuestionAutoGrader $grader) {}

    /**
     * @param  array<int, array{question_id: string, answer_text?: string|null, selected_options?: array<int, mixed>|null}>  $answers
     */
    public function record(AssignmentSubmission $submission, Assignment $assignment, array $answers): void
    {
        $given = collect($answers)->keyBy('question_id');

        foreach ($assignment->questions()->get() as $question) {
            $in = $given->get($question->id);
            if ($in === null) {
                continue;
            }
            $text = (string) ($in['answer_text'] ?? '');
            $selected = $in['selected_options'] ?? null;
            $graded = $this->grader->grade($question, $text, $selected);

            AssignmentAnswer::create([
                'submission_id' => $submission->id,
                'question_id' => $question->id,
                'answer_text' => $text,
                'selected_options' => $selected,
                'is_correct' => $graded['is_correct'],
                'awarded_points' => $graded['awarded_points'],
            ]);
        }

        $this->recompute($submission, null);
    }

    /**
     * Score = sum of awarded points. When nothing is left for the teacher (every question answered and graded)
     * the submission is marked graded; otherwise it stays "submitted" waiting for manual grading.
     */
    public function recompute(AssignmentSubmission $submission, ?TenantUser $gradedBy): void
    {
        $assignment = $submission->assignment()->first();
        $questionCount = $assignment->questions()->count();
        $answers = AssignmentAnswer::where('submission_id', $submission->id)->get();
        $pending = $answers->whereNull('awarded_points')->count() + max(0, $questionCount - $answers->count());

        $update = ['score' => $answers->sum('awarded_points')];
        if ($pending === 0 && $questionCount > 0) {
            $update += ['status' => 'graded', 'graded_at' => now()];
            if ($gradedBy) {
                $update['graded_by_user_id'] = $gradedBy->id;
            }
        }
        $submission->update($update);
    }
}
