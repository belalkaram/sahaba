<?php

namespace App\Domain\Assessment\Services;

use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ModelAnswerRelease;
use App\Models\Student;

/**
 * Decides whether a student may see the model answers of an exam or assignment.
 *
 * Every condition must hold (fail closed):
 *  1. the student has finished it (submitted an attempt / a submission),
 *  2. the teacher has published the grades,
 *  3. the teacher released the model answers for this student, their class, or everyone - or the item opted
 *     into automatic release and its window has closed (exam closes_at / assignment due_at).
 */
class ModelAnswerAccess
{
    public const NOT_FINISHED = 'NOT_FINISHED';

    public const GRADES_NOT_PUBLISHED = 'GRADES_NOT_PUBLISHED';

    public const NOT_RELEASED = 'NOT_RELEASED';

    /** @return array{allowed: bool, reason: string|null} */
    public function check(Exam|Assignment $item, Student $student): array
    {
        $isExam = $item instanceof Exam;

        if (! $this->hasFinished($item, $student)) {
            return ['allowed' => false, 'reason' => self::NOT_FINISHED];
        }

        if (! $this->gradesPublished($item, $student)) {
            return ['allowed' => false, 'reason' => self::GRADES_NOT_PUBLISHED];
        }

        if ($this->isReleased($item, $student)) {
            return ['allowed' => true, 'reason' => null];
        }

        $windowEnd = $isExam ? $item->closes_at : $item->due_at;
        if ($item->auto_release_model_answers && $windowEnd !== null && now()->greaterThan($windowEnd)) {
            return ['allowed' => true, 'reason' => null];
        }

        return ['allowed' => false, 'reason' => self::NOT_RELEASED];
    }

    public static function typeOf(Exam|Assignment $item): string
    {
        return $item instanceof Exam ? 'exam' : 'assignment';
    }

    public function hasFinished(Exam|Assignment $item, Student $student): bool
    {
        if ($item instanceof Exam) {
            return ExamAttempt::where('exam_id', $item->id)
                ->where('student_id', $student->id)
                ->where('status', '!=', 'in_progress')
                ->exists();
        }

        return AssignmentSubmission::where('assignment_id', $item->id)->where('student_id', $student->id)->exists();
    }

    public function gradesPublished(Exam|Assignment $item, Student $student): bool
    {
        if ($item instanceof Exam) {
            return (bool) $item->is_grades_published;
        }

        return AssignmentSubmission::where('assignment_id', $item->id)
            ->where('student_id', $student->id)
            ->where('is_grade_published', true)
            ->exists();
    }

    public function isReleased(Exam|Assignment $item, Student $student): bool
    {
        $classIds = $student->classes()->pluck('classes.id')->all();

        return ModelAnswerRelease::where('assessable_type', self::typeOf($item))
            ->where('assessable_id', $item->id)
            ->where(function ($q) use ($student, $classIds) {
                $q->where('scope', 'all')
                    ->orWhere(fn ($w) => $w->where('scope', 'student')->where('student_id', $student->id))
                    ->orWhere(fn ($w) => $w->where('scope', 'class')->whereIn('class_id', $classIds));
            })
            ->exists();
    }
}
