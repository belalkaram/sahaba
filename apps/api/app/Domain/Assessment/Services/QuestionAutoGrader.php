<?php

namespace App\Domain\Assessment\Services;

use App\Models\AssignmentQuestion;
use App\Models\Question;

/**
 * Auto-grades one answer to an exam or assignment question. Essays (and questions without a stored key)
 * return null so the teacher grades them manually.
 */
class QuestionAutoGrader
{
    /**
     * @param  array<int, mixed>|null  $selectedOptions
     * @return array{is_correct: bool|null, awarded_points: float|null}
     */
    public function grade(Question|AssignmentQuestion $question, string $answerText, ?array $selectedOptions): array
    {
        $raw = $question->getRawOriginal('correct_answer');
        $isCorrect = null;
        $awarded = null;

        switch ($question->question_type) {
            case 'multiple_choice':
            case 'true_false':
                if ($raw !== null) {
                    $isCorrect = trim(strtolower($answerText)) === trim(strtolower($raw));
                    $awarded = $isCorrect ? (float) $question->points : 0.00;
                }
                break;

            case 'short_answer':
                if ($raw !== null || ! empty($question->acceptable_answers)) {
                    $given = trim(strtolower($answerText));
                    $expected = array_map(
                        fn ($a) => trim(strtolower((string) $a)),
                        array_filter(array_merge([$raw], $question->acceptable_answers ?? []))
                    );
                    $isCorrect = in_array($given, $expected, true);
                    $awarded = $isCorrect ? (float) $question->points : 0.00;
                }
                break;

            case 'multiple_select':
                if (! empty($question->acceptable_answers) || $raw !== null) {
                    $expected = $question->acceptable_answers
                        ?? (is_array($raw) ? $raw : json_decode($raw ?? '[]', true));
                    if (! is_array($expected)) {
                        $expected = [$raw];
                    }
                    $given = is_array($selectedOptions)
                        ? $selectedOptions
                        : (is_array(json_decode($answerText, true)) ? json_decode($answerText, true) : [$answerText]);
                    sort($expected);
                    sort($given);
                    $isCorrect = $expected == $given;
                    $awarded = $isCorrect ? (float) $question->points : 0.00;
                }
                break;

            case 'essay':
            default:
                break;
        }

        return ['is_correct' => $isCorrect, 'awarded_points' => $awarded];
    }

    /** True when every question can be graded without a teacher (no essays, all keys present). */
    public function isFullyAutoGradable(iterable $questions): bool
    {
        foreach ($questions as $q) {
            if ($q->question_type === 'essay') {
                return false;
            }
            if ($q->getRawOriginal('correct_answer') === null && empty($q->acceptable_answers)) {
                return false;
            }
        }

        return true;
    }
}
