<?php

namespace App\Http\Controllers\Api\Billing;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Authorization\ScopeResolver;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    /**
     * List subscriptions of a student.
     */
    public function index(Request $request, string $studentId): JsonResponse
    {
        $student = Student::findOrFail($studentId);

        /** @var TenantUser $user */
        $user = $request->user();

        $isSelf = $user->student && $user->student->id === $student->id;

        if (! $isSelf && ! ScopeResolver::canAccess($user, 'subscriptions.view', $student)) {
            throw new AuthorizationException('You are not authorized to view student subscription records.');
        }

        $subscriptions = $student->subscriptions()->with(['package.entitlements', 'entitlements'])->get();

        return ApiResponse::success(['subscriptions' => $subscriptions]);
    }
}
