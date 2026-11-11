<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Support\ApiResponse;
use App\Tenancy\TenantProvisioningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class SchoolRegistrationController extends Controller
{
    protected const RESERVED_SLUGS = [
        'admin',
        'api',
        'platform',
        'app',
        'system',
        'www',
        'demo',
        'auth',
        'public',
        'login',
        'register',
        'root',
        'mail',
        'support',
    ];

    public function __construct(
        protected TenantProvisioningService $provisioningService
    ) {}

    /**
     * Self-service registration for new schools and academies.
     */
    public function register(Request $request): JsonResponse
    {
        // 1. Honeypot check
        if ($request->filled('_hp')) {
            return ApiResponse::error(
                'SPAM_DETECTED',
                'Invalid submission request.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        // 2. Validation
        $validated = $request->validate([
            'school_name' => 'required|string|min:3|max:255',
            'slug' => [
                'required',
                'string',
                'min:3',
                'max:40',
                'regex:/^[a-z0-9][a-z0-9-]*[a-z0-9]$/',
            ],
            'type' => ['nullable', 'string', Rule::in(['individual_teacher', 'organization', 'school', 'center', 'tutor', 'academy', 'university'])],
            'organization_kind' => ['nullable', 'string', Rule::in(['center', 'academy', 'school', 'institute'])],
            'services' => 'nullable|array',
            'services.*' => 'string|in:online,offline',
            'city' => 'nullable|string|max:100',
            'admin_name' => 'required|string|min:2|max:255',
            'admin_email' => 'required|email|max:255',
            'admin_phone' => 'nullable|string|max:30',
            'password' => 'required|string|min:8',
        ]);

        $slug = strtolower($validated['slug']);

        $rawType = $validated['type'] ?? 'organization';
        if (in_array($rawType, ['individual_teacher', 'tutor'], true)) {
            $type = 'individual_teacher';
            $organizationKind = null;
        } else {
            $type = 'organization';
            $organizationKind = $validated['organization_kind']
                ?? (in_array($rawType, ['center', 'academy', 'school', 'institute'], true) ? $rawType : 'center');
        }

        $services = $validated['services'] ?? ['online', 'offline'];

        // 3. Reserved slug validation
        if (in_array($slug, self::RESERVED_SLUGS, true)) {
            throw ValidationException::withMessages([
                'slug' => ['اسم النطاق هذا محجوز مسبقاً من قبل النظام.'],
            ]);
        }

        // 4. Duplicate slug validation
        if (Tenant::where('slug', $slug)->exists()) {
            throw ValidationException::withMessages([
                'slug' => ['اسم النطاق مستخدم بالفعل، يرجى اختيار اسم آخر.'],
            ]);
        }

        // 5. Provision tenant. Tenant schema migration over a remote DB (Neon) can
        // exceed PHP's default 30s limit; a fatal timeout bypasses the catch/cleanup
        // below and leaves a half-provisioned tenant, so lift the limit here.
        @set_time_limit(300);
        // Likewise, a closed tab / refresh must not abort provisioning half-way.
        ignore_user_abort(true);

        try {
            $tenant = $this->provisioningService->provision([
                'name' => $validated['school_name'],
                'slug' => $slug,
                'type' => $type,
                'organization_kind' => $organizationKind,
                'services' => $services,
                'city' => $validated['city'] ?? null,
                'contact_phone' => $validated['admin_phone'] ?? null,
                'auth_mode' => 'password',
                'owner' => [
                    'name' => $validated['admin_name'],
                    'email' => $validated['admin_email'],
                    'phone' => $validated['admin_phone'] ?? null,
                    'password' => $validated['password'],
                ],
            ], actorType: 'self_registration');

            return ApiResponse::success([
                'message' => 'تم إنشاء المؤسسة التعليمية بنجاح!',
                'tenant' => [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'slug' => $tenant->slug,
                ],
                'owner' => [
                    'email' => $validated['admin_email'],
                    'name' => $validated['admin_name'],
                ],
                'login_url' => "/login?tenant={$slug}",
            ], Response::HTTP_CREATED);
        } catch (ValidationException $ve) {
            throw $ve;
        } catch (Throwable $e) {
            return ApiResponse::error(
                'REGISTRATION_FAILED',
                'تعذر إتمام تسجيل المؤسسة التعليمية: '.$e->getMessage(),
                Response::HTTP_INTERNAL_SERVER_ERROR
            );
        }
    }
}
