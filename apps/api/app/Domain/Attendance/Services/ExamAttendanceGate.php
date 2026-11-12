<?php

namespace App\Domain\Attendance\Services;

use App\Models\AttendanceRecord;
use App\Models\Student;
use App\Models\TenantSetting;

/**
 * OD-35: an academy may require a minimum attendance rate before its students can sit exams.
 *
 * - No setting (null) = no rule.
 * - Rate = (present + late) / all recorded sessions of the student in this academy, the rate parents and students see.
 *   Classes are not linked to courses in the data model (`classes` has no `course_id`), so a per-course rate does
 *   not exist; the rule uses the student's overall rate.
 * - A student with no recorded attendance (online-only, or nothing taken yet) is not blocked: there is no rate.
 */
class ExamAttendanceGate
{
    public function minimum(): ?float
    {
        $value = TenantSetting::getValue(TenantSetting::MIN_ATTENDANCE_FOR_EXAMS);

        return is_numeric($value) && (float) $value > 0 ? (float) $value : null;
    }

    public function rate(Student $student): ?float
    {
        $query = AttendanceRecord::where('student_id', $student->id);

        $total = (clone $query)->count();
        if ($total === 0) {
            return null;
        }

        return round(((clone $query)->whereIn('status', ['present', 'late'])->count() / $total) * 100, 2);
    }

    /**
     * @return array{rate: float, minimum: float}|null The shortfall, or null when the student may sit the exam.
     */
    public function shortfall(Student $student): ?array
    {
        $minimum = $this->minimum();
        if ($minimum === null) {
            return null;
        }

        $rate = $this->rate($student);
        if ($rate === null || $rate >= $minimum) {
            return null;
        }

        return ['rate' => $rate, 'minimum' => $minimum];
    }
}
