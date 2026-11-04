<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Support\ApiResponse;
use App\Tenancy\TenantProvisioningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
            'type' => 'nullable|string|in:school,center,tutor,academy,university',
            'admin_name' => 'required|string|min:2|max:255',
            'admin_email' => 'required|email|max:255',
            'admin_phone' => 'nullable|string|max:30',
            'password' => 'required|string|min:8',
        ]);

        $slug = strtolower($validated['slug']);

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

        // 5. Provision tenant
        try {
            $tenant = $this->provisioningService->provision([
                'name' => $validated['school_name'],
                'slug' => $slug,
                'type' => $validated['type'] ?? 'school',
                'auth_mode' => 'password',
                'owner' => [
                    'name' => $validated['admin_name'],
                    'email' => $validated['admin_email'],
                    'phone' => $validated['admin_phone'] ?? null,
                    'password' => $validated['password'],
                ],
                // Default enabled modules for self-registered schools
                'modules' => ['courses', 'attendance', 'billing', 'assessments', 'offline'],
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
