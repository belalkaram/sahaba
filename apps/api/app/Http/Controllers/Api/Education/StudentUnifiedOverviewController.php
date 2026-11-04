<?php

namespace App\Http\Controllers\Api\Education;

use App\Http\Controllers\Controller;
use App\Models\GlobalIdentity;
use App\Models\StudentIdentityLink;
use App\Support\ApiResponse;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentUnifiedOverviewController extends Controller
{
    /**
     * Return unified multi-tenant overview for the authenticated student.
     * Aggregates all linked academies/tenants via GlobalIdentity.
     */
    public function __invoke(Request $request, TenantContext $context): JsonResponse
    {
        $user = $request->user();
        $currentTenant = $context->getTenantOrFail();

        // 1. Locate Global Identity by matching student email or phone, or existing link
        $globalIdentity = null;

        $existingLink = StudentIdentityLink::where('tenant_id', $currentTenant->id)
            ->where('tenant_student_id', $user->id)
            ->first();

        if ($existingLink) {
            $globalIdentity = $existingLink->globalIdentity;
        } elseif ($user->email || $user->phone) {
            $globalIdentity = GlobalIdentity::where(function ($q) use ($user) {
                if ($user->email) {
                    $q->where('email', $user->email);
                }
                if ($user->phone) {
                    $q->orWhere('phone', $user->phone);
                }
            })->first();

            // Auto-link if not yet linked
            if ($globalIdentity) {
                StudentIdentityLink::firstOrCreate([
                    'global_identity_id' => $globalIdentity->id,
                    'tenant_id' => $currentTenant->id,
                ], [
                    'tenant_student_id' => $user->id,
                ]);
            }
        }

        // If still no global identity found, synthesize a local-only entry
        if (! $globalIdentity) {
            return ApiResponse::success([
                'global_identity' => [
                    'id' => null,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                ],
                'academies' => [
                    [
                        'tenant_id' => $currentTenant->id,
                        'name' => $currentTenant->name,
                        'slug' => $currentTenant->slug,
                        'logo_url' => $currentTenant->logo_url,
                        'primary_color' => $currentTenant->primary_color ?? null,
                        'secondary_color' => $currentTenant->secondary_color ?? null,
                        'brand_tagline' => $currentTenant->brand_tagline,
                        'is_current' => true,
                    ],
                ],
                'total_academies' => 1,
            ]);
        }

        // Fetch all linked academies for this global identity
        $links = StudentIdentityLink::with('tenant')
            ->where('global_identity_id', $globalIdentity->id)
            ->get();

        $academies = $links->map(function ($link) use ($currentTenant) {
            $tenant = $link->tenant;

            return [
                'tenant_id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'logo_url' => $tenant->logo_url,
                'primary_color' => $tenant->primary_color ?? null,
                'secondary_color' => $tenant->secondary_color ?? null,
                'brand_tagline' => $tenant->brand_tagline,
                'is_current' => $tenant->id === $currentTenant->id,
                'tenant_student_id' => $link->tenant_student_id,
            ];
        });

        return ApiResponse::success([
            'global_identity' => [
                'id' => $globalIdentity->id,
                'name' => $globalIdentity->name,
                'email' => $globalIdentity->email,
                'phone' => $globalIdentity->phone,
                'status' => $globalIdentity->status,
            ],
            'academies' => $academies,
            'total_academies' => $academies->count(),
        ]);
    }
}
