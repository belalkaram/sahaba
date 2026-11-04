<?php

namespace App\Http\Controllers\Api\Auth;

use App\Domain\Authorization\Services\AuthPayloadBuilder;
use App\Http\Controllers\Controller;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    /**
     * Return authenticated user profile and permissions per canonical contract (R1-A6).
     */
    public function __invoke(Request $request, TenantContext $tenantContext): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $tenant = $tenantContext->getTenantOrFail();
        /** @var TenantToken|null $token */
        $token = $request->attributes->get('tenant_token');

        $payload = AuthPayloadBuilder::build($user, $tenant, $token);

        return ApiResponse::success($payload);
    }
}
