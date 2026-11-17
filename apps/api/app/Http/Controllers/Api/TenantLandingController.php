<?php

namespace App\Http\Controllers\Api;

use App\Domain\Platform\Services\TenantLandingService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\LandingSettingsRequest;
use App\Support\ApiResponse;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * ADR-007 (TL-1): Tenant landing page customisation endpoints.
 *
 * All routes are protected by `tenant` + `tenant.auth` + `tenant.can:tenant.branding`.
 * The tenant ID always comes from the resolved TenantContext — never from the client body/params.
 */
class TenantLandingController extends Controller
{
    public function __construct(
        private readonly TenantLandingService $landing,
        private readonly TenantContext $context,
    ) {}

    /**
     * GET /tenant/landing
     * Returns the current state: published settings (or defaults), draft (if any), templates, presets.
     */
    public function show(): JsonResponse
    {
        $tenant = $this->context->getTenantOrFail();
        $state = $this->landing->getState($tenant);

        return ApiResponse::success($state);
    }

    /**
     * PUT /tenant/landing/draft
     * Save (replace) the draft. Idempotent — safe to call on every auto-save.
     */
    public function saveDraft(LandingSettingsRequest $request): JsonResponse
    {
        $tenant = $this->context->getTenantOrFail();
        $row = $this->landing->saveDraft($tenant, $request->validatedWithSchema());

        return ApiResponse::success([
            'draft' => $row->draft,
            'message' => 'تم حفظ المسودة.',
        ]);
    }

    /**
     * POST /tenant/landing/publish
     * Publish the current draft; bumps version, syncs primary colour, writes audit entry.
     */
    public function publish(Request $request): JsonResponse
    {
        $tenant = $this->context->getTenantOrFail();

        try {
            $row = $this->landing->publish($tenant, (string) $request->user()->id);
        } catch (\DomainException $e) {
            return ApiResponse::error('NO_DRAFT', $e->getMessage(), Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return ApiResponse::success([
            'published' => $row->published,
            'version' => $row->version,
            'published_at' => $row->published_at?->toIso8601String(),
            'message' => 'تم نشر إعدادات الصفحة بنجاح.',
        ]);
    }

    /**
     * DELETE /tenant/landing/draft
     * Discard the draft and revert to what was last published.
     */
    public function discardDraft(): JsonResponse
    {
        $tenant = $this->context->getTenantOrFail();
        $this->landing->discardDraft($tenant);

        return ApiResponse::success(['message' => 'تم حذف المسودة.']);
    }

    /**
     * POST /tenant/landing/preview-token
     * Issue a 15-minute signed preview token for the current draft.
     */
    public function issuePreviewToken(): JsonResponse
    {
        $tenant = $this->context->getTenantOrFail();
        $rawToken = $this->landing->issuePreviewToken($tenant);

        return ApiResponse::success([
            'token' => $rawToken,
            'expires_in_seconds' => 900,
            'preview_url' => "/a/{$tenant->slug}?preview={$rawToken}",
        ]);
    }
}
