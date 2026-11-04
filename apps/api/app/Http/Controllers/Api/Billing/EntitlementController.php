<?php

namespace App\Http\Controllers\Api\Billing;

use App\Http\Controllers\Controller;
use App\Models\Entitlement;
use App\Models\Student;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use App\Support\Authorization\ScopeResolver;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EntitlementController extends Controller
{
    /**
     * List active entitlements of a student.
     */
    public function index(Request $request, string $studentId): JsonResponse
    {
        $student = Student::findOrFail($studentId);

        /** @var TenantUser $user */
        $user = $request->user();

        $isSelf = $user->student && $user->student->id === $student->id;

        if (! $isSelf && ! ScopeResolver::canAccess($user, 'entitlements.view', $student)) {
            throw new AuthorizationException('You are not authorized to view student entitlements.');
        }

        $entitlements = $student->entitlements()
            ->where('is_active', true)
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>=', now());
            })
            ->get();

        return ApiResponse::success(['entitlements' => $entitlements]);
    }

    /**
     * Grant an entitlement manually to a student (R3-4).
     */
    public function grant(Request $request, string $studentId): JsonResponse
    {
        $student = Student::findOrFail($studentId);

        $validated = $request->validate([
            'entitlement_key' => 'required|string|max:100',
            'expires_at' => 'nullable|date|after:now',
            'reason' => 'required|string|max:500',
        ]);

        /** @var TenantUser $user */
        $user = $request->user();

        $entitlement = Entitlement::create([
            'student_id' => $student->id,
            'subscription_id' => null,
            'entitlement_key' => $validated['entitlement_key'],
            'is_active' => true,
            'expires_at' => $validated['expires_at'] ?? null,
            'reason' => $validated['reason'],
            'granted_by_user_id' => $user->id,
        ]);

        AuditLogger::log(
            action: 'entitlement.granted',
            entityType: 'Entitlement',
            entityId: $entitlement->id,
            payload: [
                'student_id' => $student->id,
                'entitlement_key' => $entitlement->entitlement_key,
                'expires_at' => $entitlement->expires_at,
                'reason' => $validated['reason'],
            ],
            actorId: $user->id
        );

        return ApiResponse::success([
            'message' => 'Entitlement granted successfully.',
            'entitlement' => $entitlement,
        ], Response::HTTP_CREATED);
    }

    /**
     * Revoke an active entitlement (R3-4).
     */
    public function revoke(Request $request, string $id): JsonResponse
    {
        $entitlement = Entitlement::findOrFail($id);

        $validated = $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        /** @var TenantUser $user */
        $user = $request->user();

        $entitlement->update([
            'is_active' => false,
            'reason' => $validated['reason'],
        ]);

        AuditLogger::log(
            action: 'entitlement.revoked',
            entityType: 'Entitlement',
            entityId: $entitlement->id,
            payload: [
                'student_id' => $entitlement->student_id,
                'entitlement_key' => $entitlement->entitlement_key,
                'reason' => $validated['reason'],
            ],
            actorId: $user->id
        );

        return ApiResponse::success([
            'message' => 'Entitlement revoked successfully.',
            'entitlement' => $entitlement->fresh(),
        ]);
    }
}
