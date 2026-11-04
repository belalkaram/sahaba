<?php

namespace App\Domain\Reporting\Services;

use App\Models\AttendanceRecord;
use App\Models\Course;
use App\Models\Grade;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\PaymentRequest;
use App\Models\ReportInstance;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Tenancy\TenantContext;
use DomainException;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * R8-5: builds report data (tabular) and writes the CSV file to the private disk.
 * Authorization happens before the report is queued (ReportController).
 * PDF is not generated here: it needs an Arabic-capable library (pending owner approval); the UI
 * offers a browser print view of the same data instead.
 */
class ReportGenerationService
{
    public const TYPE_STUDENT = 'student';

    public const TYPE_PARENT = 'parent';

    public const TYPE_CLASS_ATTENDANCE = 'class_attendance';

    public const TYPE_COURSE_PROGRESS = 'course_progress';

    public const TYPE_PAYMENTS = 'payments';

    public const TYPES = [
        self::TYPE_STUDENT,
        self::TYPE_PARENT,
        self::TYPE_CLASS_ATTENDANCE,
        self::TYPE_COURSE_PROGRESS,
        self::TYPE_PAYMENTS,
    ];

    public function __construct(private readonly TenantContext $context) {}

    public function generate(ReportInstance $report): ReportInstance
    {
        $report->update(['status' => 'processing']);

        try {
            $params = $report->parameters ?? [];
            $type = $params['type'] ?? self::TYPE_STUDENT;

            $payload = [
                'report_title' => $report->title,
                'type' => $type,
                'format' => $report->format,
                'generated_at' => now()->toIso8601String(),
                ...match ($type) {
                    self::TYPE_STUDENT, self::TYPE_PARENT => $this->studentReport($params),
                    self::TYPE_CLASS_ATTENDANCE => $this->classAttendanceReport($params),
                    self::TYPE_COURSE_PROGRESS => $this->courseProgressReport($params),
                    self::TYPE_PAYMENTS => $this->paymentsReport($params),
                    default => throw new DomainException("Unknown report type [{$type}]."),
                },
            ];

            $report->update([
                'status' => 'completed',
                'data_payload' => $payload,
                'file_path' => $report->format === 'csv' ? $this->writeCsv($report, $payload) : null,
                'completed_at' => now(),
            ]);
        } catch (Throwable $e) {
            $report->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);
        }

        return $report;
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function studentReport(array $params): array
    {
        $student = Student::with('user')->findOrFail($params['student_id'] ?? null);
        $grades = Grade::where('student_id', $student->id)->where('is_published', true)->orderBy('graded_at')->get();
        $attendance = AttendanceRecord::where('student_id', $student->id)->get();
        $attended = $attendance->whereIn('status', ['present', 'late'])->count();

        return [
            'student' => [
                'id' => $student->id,
                'name' => $student->user?->name,
                'student_code' => $student->student_code,
                'grade_level' => $student->grade_level,
            ],
            'summary' => [
                ['label' => 'الطالب', 'value' => $student->user?->name],
                ['label' => 'عدد الدرجات المنشورة', 'value' => $grades->count()],
                ['label' => 'متوسط الدرجات', 'value' => $grades->isEmpty() ? null : round((float) $grades->avg('percentage'), 2)],
                ['label' => 'الحصص المسجّلة', 'value' => $attendance->count()],
                ['label' => 'نسبة الحضور', 'value' => $attendance->isEmpty() ? null : round(($attended / $attendance->count()) * 100, 2)],
            ],
            'columns' => [
                ['key' => 'type', 'label' => 'النوع'],
                ['key' => 'score', 'label' => 'الدرجة'],
                ['key' => 'max_score', 'label' => 'من'],
                ['key' => 'percentage', 'label' => 'النسبة'],
                ['key' => 'graded_at', 'label' => 'التاريخ'],
            ],
            'rows' => $grades->map(fn (Grade $g) => [
                'type' => $g->gradable_type === 'exam' ? 'اختبار' : 'واجب',
                'score' => (float) $g->score,
                'max_score' => (float) $g->max_score,
                'percentage' => (float) $g->percentage,
                'graded_at' => $g->graded_at?->toDateString(),
            ])->values()->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function classAttendanceReport(array $params): array
    {
        $class = SchoolClass::findOrFail($params['class_id'] ?? null);
        $records = AttendanceRecord::whereHas('session', fn ($q) => $q->where('class_id', $class->id))->get()->groupBy('student_id');

        $rows = $class->students()->with('user')->get()->map(function (Student $student) use ($records) {
            $own = $records->get($student->id, collect());
            $attended = $own->whereIn('status', ['present', 'late'])->count();

            return [
                'student' => $student->user?->name,
                'student_code' => $student->student_code,
                'recorded' => $own->count(),
                'attended' => $attended,
                'absent' => $own->where('status', 'absent')->count(),
                'rate' => $own->isEmpty() ? null : round(($attended / $own->count()) * 100, 2),
            ];
        })->values()->all();

        return [
            'summary' => [['label' => 'الشعبة', 'value' => $class->name], ['label' => 'عدد الطلاب', 'value' => count($rows)]],
            'columns' => [
                ['key' => 'student', 'label' => 'الطالب'],
                ['key' => 'student_code', 'label' => 'الكود'],
                ['key' => 'recorded', 'label' => 'الحصص المسجّلة'],
                ['key' => 'attended', 'label' => 'حضر'],
                ['key' => 'absent', 'label' => 'غاب'],
                ['key' => 'rate', 'label' => 'نسبة الحضور'],
            ],
            'rows' => $rows,
        ];
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function courseProgressReport(array $params): array
    {
        $course = Course::findOrFail($params['course_id'] ?? null);
        $lessonIds = Lesson::where('course_id', $course->id)->where('status', 'published')->pluck('id');

        $rows = $course->enrollments()->with('student.user')->where('status', 'active')->get()->map(function ($enrollment) use ($lessonIds) {
            $completed = LessonProgress::where('student_id', $enrollment->student_id)
                ->whereIn('lesson_id', $lessonIds)
                ->whereNotNull('completed_at')
                ->count();

            return [
                'student' => $enrollment->student?->user?->name,
                'student_code' => $enrollment->student?->student_code,
                'lessons_completed' => $completed,
                'lessons_total' => $lessonIds->count(),
                'rate' => $lessonIds->isEmpty() ? null : round(($completed / $lessonIds->count()) * 100, 2),
            ];
        })->values()->all();

        return [
            'summary' => [['label' => 'المقرر', 'value' => $course->title], ['label' => 'عدد الطلاب', 'value' => count($rows)]],
            'columns' => [
                ['key' => 'student', 'label' => 'الطالب'],
                ['key' => 'student_code', 'label' => 'الكود'],
                ['key' => 'lessons_completed', 'label' => 'دروس مكتملة'],
                ['key' => 'lessons_total', 'label' => 'إجمالي الدروس'],
                ['key' => 'rate', 'label' => 'نسبة الإنجاز'],
            ],
            'rows' => $rows,
        ];
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function paymentsReport(array $params): array
    {
        $query = PaymentRequest::with('student.user', 'package')->orderByDesc('submitted_at');

        if (! empty($params['from'])) {
            $query->whereDate('submitted_at', '>=', $params['from']);
        }
        if (! empty($params['to'])) {
            $query->whereDate('submitted_at', '<=', $params['to']);
        }

        $payments = $query->get();

        return [
            'summary' => [
                ['label' => 'عدد الطلبات', 'value' => $payments->count()],
                ['label' => 'إجمالي المعتمد', 'value' => (float) $payments->where('status', 'approved')->sum('amount')],
            ],
            'columns' => [
                ['key' => 'student', 'label' => 'الطالب'],
                ['key' => 'package', 'label' => 'الباقة'],
                ['key' => 'amount', 'label' => 'المبلغ'],
                ['key' => 'currency', 'label' => 'العملة'],
                ['key' => 'status', 'label' => 'الحالة'],
                ['key' => 'submitted_at', 'label' => 'تاريخ الطلب'],
            ],
            'rows' => $payments->map(fn (PaymentRequest $p) => [
                'student' => $p->student?->user?->name,
                'package' => $p->package?->name,
                'amount' => (float) $p->amount,
                'currency' => $p->currency,
                'status' => $p->status,
                'submitted_at' => $p->submitted_at?->toDateString(),
            ])->values()->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function writeCsv(ReportInstance $report, array $payload): string
    {
        $handle = fopen('php://temp', 'r+');
        fwrite($handle, "\xEF\xBB\xBF"); // BOM so Excel reads Arabic correctly

        fputcsv($handle, array_column($payload['columns'], 'label'));
        foreach ($payload['rows'] as $row) {
            fputcsv($handle, array_map(
                fn ($column) => $this->safeCell($row[$column['key']] ?? null),
                $payload['columns']
            ));
        }

        rewind($handle);
        $content = stream_get_contents($handle);
        fclose($handle);

        $path = 'reports/'.($this->context->getTenantId() ?? 'unknown')."/{$report->id}.csv";
        Storage::disk('local')->put($path, $content);

        return $path;
    }

    /**
     * Neutralizes spreadsheet formula injection in user-controlled text.
     */
    private function safeCell(mixed $value): mixed
    {
        if (is_string($value) && $value !== '' && in_array($value[0], ['=', '+', '-', '@', "\t", "\r"], true)) {
            return "'".$value;
        }

        return $value;
    }
}
