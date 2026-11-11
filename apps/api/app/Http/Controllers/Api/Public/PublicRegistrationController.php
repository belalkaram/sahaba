<?php

namespace App\Http\Controllers\Api\Public;

use App\Domain\Identity\Services\StudentRegistrationService;
use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Support\ApiResponse;
use App\Support\Saudi\SaudiRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

/** Unauthenticated student self-registration (Saudi market). */
class PublicRegistrationController extends Controller
{
    public function __construct(protected StudentRegistrationService $service) {}

    /** Reference lists for the form (regions, stages) so the client never hard-codes them. */
    public function options(): JsonResponse
    {
        return ApiResponse::success([
            'regions' => collect(SaudiRules::REGIONS)->map(fn ($label, $key) => ['value' => $key, 'label' => $label])->values(),
            'stages' => collect(SaudiRules::STAGES)->map(fn ($s, $key) => ['value' => $key, 'label' => $s['name'], 'grades' => $s['grades']])->values(),
            'max_tenants' => StudentRegistrationService::MAX_TENANTS,
        ]);
    }

    public function directory(Request $request): JsonResponse
    {
        $tenants = $this->service->directory($request->query('q'));

        return ApiResponse::success(['academies' => $tenants->map(fn (Tenant $t) => [
            'slug' => $t->slug,
            'name' => $t->name,
            'type' => $t->type,
            'organization_kind' => $t->organization_kind,
            'city' => $t->city,
            'tagline' => $t->brand_tagline,
            'logo_url' => $t->logo_url,
        ])->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        // Honeypot: real users never see or fill this field.
        if ($request->filled('website')) {
            return ApiResponse::success(['results' => []], Response::HTTP_CREATED);
        }

        $input = $request->all();
        foreach (['national_id'] as $key) {
            if (isset($input[$key]) && is_string($input[$key])) {
                $input[$key] = SaudiRules::normalizeDigits($input[$key]);
            }
        }
        foreach (['student_phone', 'guardian_phone'] as $key) {
            if (isset($input[$key]) && is_string($input[$key])) {
                $input[$key] = SaudiRules::normalizeMobile($input[$key]) ?? $input[$key];
            }
        }
        $request->merge($input);

        $data = $request->validate([
            'full_name' => ['required', 'string', 'min:6', 'max:200', 'regex:/^[\p{Arabic}\p{L}\s\'\-]+$/u'],
            'national_id' => ['required', 'string', function (string $attribute, mixed $value, \Closure $fail) {
                if (! SaudiRules::isValidNationalId($value)) {
                    $fail('رقم الهوية غير صحيح.');
                }
            }],
            'region' => ['required', Rule::in(array_keys(SaudiRules::REGIONS))],
            'governorate' => ['required', 'string', 'max:120'],
            'address' => ['required', 'string', 'min:5', 'max:300'],
            'education_stage' => ['required', Rule::in(array_keys(SaudiRules::STAGES))],
            'grade' => ['required', 'integer', 'min:1', 'max:6'],
            'student_phone' => ['required', 'regex:/^05\d{8}$/'],
            'guardian_name' => ['required', 'string', 'min:6', 'max:200'],
            'guardian_phone' => ['required', 'regex:/^05\d{8}$/', 'different:student_phone'],
            'guardian_occupation' => ['nullable', 'string', 'max:150'],
            'email' => ['nullable', 'email:rfc', 'max:190'],
            'password' => ['required', 'string', 'min:8', 'max:100', 'confirmed', 'regex:/[A-Za-z]/', 'regex:/\d/'],
            'tenants' => ['required', 'array', 'min:1', 'max:'.StudentRegistrationService::MAX_TENANTS],
            'tenants.*' => ['required', 'string', 'max:100'],
        ], [
            'student_phone.regex' => 'رقم جوال الطالب يجب أن يكون جوالًا سعوديًا يبدأ بـ 05.',
            'guardian_phone.regex' => 'رقم جوال ولي الأمر يجب أن يكون جوالًا سعوديًا يبدأ بـ 05.',
            'guardian_phone.different' => 'يجب أن يختلف جوال ولي الأمر عن جوال الطالب.',
            'password.regex' => 'كلمة المرور يجب أن تحتوي على حروف وأرقام.',
        ]);

        if (! SaudiRules::isValidGrade($data['education_stage'], (int) $data['grade'])) {
            throw ValidationException::withMessages(['grade' => ['الصف غير صالح لهذه المرحلة.']]);
        }

        $results = $this->service->submit($data, $data['tenants']);

        return ApiResponse::success(['results' => $results], Response::HTTP_CREATED);
    }

    public function status(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tenant' => ['required', 'string', 'max:100'],
            'reference' => ['required', 'string', 'max:20'],
            'phone' => ['required', 'string', 'max:30'],
        ]);

        $mobile = SaudiRules::normalizeMobile($validated['phone']);
        $tenant = Tenant::where('slug', $validated['tenant'])->where('status', 'active')->first();
        $status = ($tenant && $mobile) ? $this->service->status($tenant, $validated['reference'], $mobile) : null;

        // Same answer for "no such reference" and "wrong phone": nothing to enumerate.
        if ($status === null) {
            return ApiResponse::error('REGISTRATION_NOT_FOUND', 'No matching request.', Response::HTTP_NOT_FOUND);
        }

        return ApiResponse::success(['status' => $status]);
    }
}
