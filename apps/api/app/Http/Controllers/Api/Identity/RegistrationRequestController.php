<?php

namespace App\Http\Controllers\Api\Identity;

use App\Domain\Identity\Services\StudentRegistrationService;
use App\Http\Controllers\Controller;
use App\Models\StudentRegistrationRequest;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Authorization\ScopeResolver;
use App\Support\Saudi\SaudiRules;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Review inbox for student registration requests (tenant admin / independent teacher). */
class RegistrationRequestController extends Controller
{
    public function __construct(protected StudentRegistrationService $service) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeReviewer($request->user());

        $status = $request->query('status', 'pending');
        $query = StudentRegistrationRequest::query()->orderByDesc('created_at');
        if (in_array($status, ['pending', 'approved', 'rejected'], true)) {
            $query->where('status', $status);
        }

        $page = $query->paginate(20);
        $page->setCollection($page->getCollection()->map(fn ($r) => $this->present($r)));

        return ApiResponse::paginated($page);
    }

    public function pendingCount(Request $request): JsonResponse
    {
        $this->authorizeReviewer($request->user());

        return ApiResponse::success(['pending' => StudentRegistrationRequest::where('status', 'pending')->count()]);
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $this->authorizeReviewer($user);
        $note = $request->validate(['note' => 'nullable|string|max:500'])['note'] ?? null;
        $registration = StudentRegistrationRequest::findOrFail($id);

        try {
            $student = $this->service->approve($registration, $user, $note);
        } catch (\DomainException) {
            return ApiResponse::error('REQUEST_NOT_PENDING', 'This request was already decided.', Response::HTTP_CONFLICT);
        }

        return ApiResponse::success(['request' => $this->present($registration->fresh()), 'student_id' => $student->id]);
    }

    public function reject(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $this->authorizeReviewer($user);
        $note = $request->validate(['note' => 'nullable|string|max:500'])['note'] ?? null;
        $registration = StudentRegistrationRequest::findOrFail($id);

        try {
            $this->service->reject($registration, $user, $note);
        } catch (\DomainException) {
            return ApiResponse::error('REQUEST_NOT_PENDING', 'This request was already decided.', Response::HTTP_CONFLICT);
        }

        return ApiResponse::success(['request' => $this->present($registration->fresh())]);
    }

    /** Needs students.create at tenant scope: a branch-scoped manager cannot decide for the whole tenant. */
    protected function authorizeReviewer(TenantUser $user): void
    {
        if (! $user->hasPermissionTo('students.create') || ScopeResolver::resolveScope($user, 'students.create') !== 'tenant') {
            throw new AuthorizationException('Forbidden.');
        }
    }

    /** The full national ID is never returned; reviewers see the last four digits. */
    protected function present(StudentRegistrationRequest $r): array
    {
        return [
            'id' => $r->id,
            'reference_code' => $r->reference_code,
            'full_name' => $r->full_name,
            'national_id_masked' => SaudiRules::maskNationalId((string) $r->national_id),
            'region' => SaudiRules::REGIONS[$r->region] ?? $r->region,
            'governorate' => $r->governorate,
            'address' => $r->address,
            'grade_label' => SaudiRules::gradeLabel($r->education_stage, $r->grade),
            'student_phone' => $r->student_phone,
            'guardian_name' => $r->guardian_name,
            'guardian_phone' => $r->guardian_phone,
            'guardian_occupation' => $r->guardian_occupation,
            'email' => $r->email,
            'status' => $r->status,
            'decision_note' => $r->decision_note,
            'decided_at' => $r->decided_at?->toIso8601String(),
            'created_at' => $r->created_at?->toIso8601String(),
            'duplicate_count' => StudentRegistrationRequest::where('national_id_hash', $r->national_id_hash)->where('id', '!=', $r->id)->count(),
        ];
    }
}
