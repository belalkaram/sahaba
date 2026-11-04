<?php

namespace App\Http\Controllers\Api\Reporting;

use App\Domain\Reporting\Services\ReportGenerationService;
use App\Http\Controllers\Controller;
use App\Jobs\GenerateReport;
use App\Models\Course;
use App\Models\ReportInstance;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Authorization\ScopeResolver;
use App\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    /**
     * List reports: tenant-scoped report viewers see all, everyone else only their own.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $query = ReportInstance::query()->with('definition');

        if ($user->permissionScope('reports.view') !== 'tenant') {
            $query->where('requested_by_user_id', $user->id);
        }

        $reports = $query->orderBy('created_at', 'desc')->limit(100)->get()->makeHidden('data_payload');

        return ApiResponse::success(['reports' => $reports]);
    }

    /**
     * Queue a new report. Data scope is enforced here (FR-REPORT-003).
     */
    public function store(Request $request, TenantContext $context): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'type' => ['nullable', 'string', Rule::in(ReportGenerationService::TYPES)],
            'report_definition_id' => 'nullable|uuid|exists:tenant.report_definitions,id',
            'format' => 'nullable|string|in:json,csv,pdf',
            'parameters' => 'nullable|array',
            'parameters.student_id' => 'nullable|uuid',
            'parameters.class_id' => 'nullable|uuid',
            'parameters.course_id' => 'nullable|uuid',
            'parameters.from' => 'nullable|date',
            'parameters.to' => 'nullable|date',
        ]);

        if (($validated['format'] ?? null) === 'pdf') {
            return ApiResponse::error(
                'REPORT_FORMAT_UNAVAILABLE',
                'تصدير PDF غير متاح بعد. استخدم CSV أو الطباعة من صفحة التقرير.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        /** @var TenantUser $user */
        $user = $request->user();
        $parameters = $validated['parameters'] ?? [];
        $type = $validated['type'] ?? ReportGenerationService::TYPE_STUDENT;

        $this->authorizeRequest($user, $type, $parameters);

        $report = ReportInstance::create([
            'title' => $validated['title'],
            'report_definition_id' => $validated['report_definition_id'] ?? null,
            'requested_by_user_id' => $user->id,
            'status' => 'queued',
            'format' => $validated['format'] ?? 'json',
            'parameters' => [...$parameters, 'type' => $type],
        ]);

        GenerateReport::dispatch($context->getTenantOrFail()->id, $report->id);

        return ApiResponse::success(['report' => $report->fresh()], Response::HTTP_CREATED);
    }

    /**
     * Show report status and data.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $report = ReportInstance::with('definition')->findOrFail($id);

        if (! $this->canSee($request->user(), $report)) {
            throw new AuthorizationException('You are not authorized to view this report.');
        }

        return ApiResponse::success(['report' => $report]);
    }

    /**
     * Report data (JSON) with authorization verification.
     */
    public function download(Request $request, string $id): JsonResponse
    {
        $report = ReportInstance::findOrFail($id);
        $this->authorizeDownload($request->user(), $report);

        if ($report->status !== 'completed') {
            return ApiResponse::error(
                'REPORT_NOT_READY',
                "Report is currently {$report->status} and cannot be downloaded.",
                Response::HTTP_BAD_REQUEST
            );
        }

        return ApiResponse::success([
            'report_id' => $report->id,
            'title' => $report->title,
            'format' => $report->format,
            'has_file' => $report->file_path !== null,
            'payload' => $report->data_payload,
        ]);
    }

    /**
     * Stream the generated file. Same authorization as download; the file is on the private disk.
     */
    public function file(Request $request, string $id): StreamedResponse|JsonResponse
    {
        $report = ReportInstance::findOrFail($id);
        $this->authorizeDownload($request->user(), $report);

        if ($report->status !== 'completed' || ! $report->file_path || ! Storage::disk('local')->exists($report->file_path)) {
            return ApiResponse::error('REPORT_FILE_NOT_FOUND', 'لا يوجد ملف لهذا التقرير.', Response::HTTP_NOT_FOUND);
        }

        return Storage::disk('local')->download($report->file_path, "report-{$report->id}.{$report->format}");
    }

    /**
     * @param  array<string, mixed>  $parameters
     *
     * @throws AuthorizationException
     */
    private function authorizeRequest(TenantUser $user, string $type, array $parameters): void
    {
        $allowed = match ($type) {
            ReportGenerationService::TYPE_STUDENT, ReportGenerationService::TYPE_PARENT => $this->canReportOnStudent($user, $parameters['student_id'] ?? null),
            ReportGenerationService::TYPE_CLASS_ATTENDANCE => $this->canReportOn($user, SchoolClass::find($parameters['class_id'] ?? null)),
            ReportGenerationService::TYPE_COURSE_PROGRESS => $this->canReportOn($user, Course::find($parameters['course_id'] ?? null)),
            ReportGenerationService::TYPE_PAYMENTS => $user->permissionScope('reports.generate') === 'tenant' && $user->hasPermissionTo('payments.view'),
            default => false,
        };

        if (! $allowed) {
            throw new AuthorizationException('You are not authorized to generate this report.');
        }
    }

    private function canReportOnStudent(TenantUser $user, ?string $studentId): bool
    {
        $student = $studentId ? Student::find($studentId) : null;
        if (! $student) {
            return false;
        }

        // Parents may generate reports for their own linked children only.
        if ($user->parentProfile?->students()->where('students.id', $student->id)->exists()) {
            return true;
        }

        return $this->canReportOn($user, $student);
    }

    private function canReportOn(TenantUser $user, Student|SchoolClass|Course|null $resource): bool
    {
        return $resource !== null && ScopeResolver::canAccess($user, 'reports.generate', $resource);
    }

    private function canSee(TenantUser $user, ReportInstance $report): bool
    {
        return $report->requested_by_user_id === $user->id || $user->permissionScope('reports.view') === 'tenant';
    }

    /**
     * @throws AuthorizationException
     */
    private function authorizeDownload(TenantUser $user, ReportInstance $report): void
    {
        if ($report->requested_by_user_id !== $user->id && $user->permissionScope('reports.download') !== 'tenant') {
            throw new AuthorizationException('You are not authorized to download this report.');
        }
    }
}
