<?php

namespace App\Domain\Platform\Services;

use App\Models\Tenant;
use App\Models\TenantLandingSettings;
use App\Support\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * ADR-007 (TL-1): Landing page customisation for a tenant.
 *
 * Invariants:
 * - Only the control DB is touched here (TenantLandingSettings lives in the control DB).
 * - On publish, palette.primary is synced back to tenants.primary_color (OD-42).
 * - Preview tokens are stored as SHA-256 hashes; the raw token is returned once and never persisted.
 * - A missing published record means the tenant uses the platform default (template=oasis, platform palette).
 */
class TenantLandingService
{
    /** The five allowed template IDs. */
    public const TEMPLATES = ['oasis', 'beacon', 'breeze', 'atlas', 'horizon'];

    /** Default schema version for new settings documents. */
    public const SCHEMA_VERSION = 1;

    /** Default landing settings when no record exists. */
    public static function defaults(): array
    {
        return [
            'schema' => self::SCHEMA_VERSION,
            'template' => 'oasis',
            'palette' => [
                'primary' => '#0C7F6D',
                'secondary' => '#0B6659',
                'accent' => '#9C6B36',
                'surface' => '#F8F8F6',
            ],
            'sections' => [
                'stats' => true,
                'courses' => true,
                'teachers' => true,
                'about' => false,
                'contact' => false,
                'faq' => false,
            ],
            'content' => [
                'cover_path' => null,
                'about' => ['text' => '', 'highlights' => []],
                'contact' => [
                    'phone' => null,
                    'whatsapp' => null,
                    'email' => null,
                    'address' => null,
                    'map_url' => null,
                    'social' => [],
                ],
                'faq' => [],
            ],
        ];
    }

    /**
     * Get the current state: published record (or defaults) + draft (or null) + available templates + presets.
     */
    public function getState(Tenant $tenant): array
    {
        $row = TenantLandingSettings::where('tenant_id', $tenant->id)->first();

        return [
            'published' => $row?->published ?? self::defaults(),
            'draft' => $row?->draft,
            'version' => $row?->version ?? 0,
            'published_at' => $row?->published_at?->toIso8601String(),
            'templates' => $this->templateList(),
            'presets' => $this->palettePresets(),
        ];
    }

    /**
     * Save a draft (full replacement, idempotent).
     * Content is already validated by LandingSettingsRequest before it arrives here.
     */
    public function saveDraft(Tenant $tenant, array $validated): TenantLandingSettings
    {
        return TenantLandingSettings::updateOrCreate(
            ['tenant_id' => $tenant->id],
            ['draft' => $validated]
        );
    }

    /**
     * Publish the current draft.
     * - If no draft exists, publishes the defaults.
     * - Copies palette.primary → tenants.primary_color (OD-42, keeps workspace consistent).
     * - Writes an audit entry.
     *
     * @throws \DomainException if no draft exists and no previous record exists
     */
    public function publish(Tenant $tenant, string $actorId): TenantLandingSettings
    {
        $row = TenantLandingSettings::where('tenant_id', $tenant->id)->first();

        if (! $row) {
            throw new \DomainException('لا توجد مسودة للنشر. احفظ مسودة أولاً.');
        }

        $draft = $row->draft;
        if (! $draft) {
            throw new \DomainException('لا توجد مسودة للنشر. احفظ مسودة أولاً.');
        }

        return DB::transaction(function () use ($tenant, $row, $draft, $actorId) {
            $row->update([
                'published' => $draft,
                'draft' => null,
                'version' => $row->version + 1,
                'published_at' => now(),
                'published_by' => $actorId,
                // Invalidate any pending preview token on publish
                'preview_token_hash' => null,
                'preview_expires_at' => null,
            ]);

            // OD-42: sync primary colour back to the tenant record so the workspace matches.
            $primary = $draft['palette']['primary'] ?? null;
            if ($primary && preg_match('/^#[0-9a-fA-F]{6}$/', $primary)) {
                $tenant->update(['primary_color' => $primary]);
            }

            AuditLogger::log(
                action: 'tenant.landing.published',
                tenantId: $tenant->id,
                entityType: 'TenantLandingSettings',
                entityId: $row->id,
                payload: [
                    'template' => $draft['template'] ?? null,
                    'palette' => $draft['palette'] ?? null,
                    'version' => $row->version,
                ],
                actorId: $actorId,
            );

            return $row->fresh();
        });
    }

    /**
     * Discard the current draft (revert to published).
     */
    public function discardDraft(Tenant $tenant): void
    {
        TenantLandingSettings::where('tenant_id', $tenant->id)->update(['draft' => null]);
    }

    /**
     * Issue a 15-minute preview token for the current draft.
     * Returns the raw (unhashed) token to send to the client.
     */
    public function issuePreviewToken(Tenant $tenant): string
    {
        $raw = Str::random(40);
        $hash = hash('sha256', $raw);

        TenantLandingSettings::updateOrCreate(
            ['tenant_id' => $tenant->id],
            [
                'preview_token_hash' => $hash,
                'preview_expires_at' => now()->addMinutes(15),
            ]
        );

        return $raw;
    }

    /**
     * Resolve the public landing data for a tenant:
     * - ?preview=<token>: returns draft if valid, otherwise published (no error — security: don't reveal).
     * - Otherwise: returns published (or defaults).
     * - Strips contact fields that have published=false.
     */
    public function resolvePublic(Tenant $tenant, ?string $previewToken = null): array
    {
        $row = TenantLandingSettings::where('tenant_id', $tenant->id)->first();

        // Try draft via preview token
        if ($previewToken && $row && $row->isPreviewTokenValid($previewToken) && $row->draft) {
            return $this->stripUnpublishedContact($row->draft);
        }

        $data = $row?->published ?? self::defaults();

        return $this->stripUnpublishedContact($data);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Remove contact sub-fields that the tenant has not opted into publishing.
     * The sections.contact toggle gates the whole section; individual field-level
     * publish controls (TL-6) will extend this later.
     */
    private function stripUnpublishedContact(array $data): array
    {
        if (empty($data['sections']['contact'])) {
            $data['content']['contact'] = null;

            return $data;
        }

        // OD-43: each contact field is opt-in. Only fields whose `<field>_published` flag is true
        // leave the server; the flags themselves are not exposed.
        $contact = $data['content']['contact'] ?? [];
        $public = [];
        foreach (['phone', 'whatsapp', 'email', 'address', 'map_url'] as $field) {
            if (! empty($contact[$field]) && ! empty($contact["{$field}_published"])) {
                $public[$field] = $contact[$field];
            }
        }
        $data['content']['contact'] = $public === [] ? null : $public;

        return $data;
    }

    private function templateList(): array
    {
        return [
            ['id' => 'oasis',   'name_ar' => 'الواحة',   'audience' => 'الافتراضي لكل أكاديمية'],
            ['id' => 'beacon',  'name_ar' => 'المنارة',  'audience' => 'الأكاديميات والمعاهد الكبيرة'],
            ['id' => 'breeze',  'name_ar' => 'النسيم',   'audience' => 'المدارس والمراحل الابتدائية والمعلم الخاص'],
            ['id' => 'atlas',   'name_ar' => 'الأطلس',   'audience' => 'المراكز متعددة الفروع'],
            ['id' => 'horizon', 'name_ar' => 'الأفق',    'audience' => 'المعلم المستقل'],
        ];
    }

    private function palettePresets(): array
    {
        return [
            ['name_ar' => 'الواحة (افتراضي)',   'primary' => '#0C7F6D', 'secondary' => '#0B6659', 'accent' => '#9C6B36', 'surface' => '#F8F8F6'],
            ['name_ar' => 'الصحراء',             'primary' => '#92400E', 'secondary' => '#78350F', 'accent' => '#B45309', 'surface' => '#FFF8F0'],
            ['name_ar' => 'البحر',               'primary' => '#0369A1', 'secondary' => '#075985', 'accent' => '#0891B2', 'surface' => '#F0F8FF'],
            ['name_ar' => 'الليل',               'primary' => '#B45309', 'secondary' => '#92400E', 'accent' => '#D97706', 'surface' => '#0B1110'],
            ['name_ar' => 'الربيع',              'primary' => '#15803D', 'secondary' => '#166534', 'accent' => '#BE185D', 'surface' => '#F0FFF4'],
            ['name_ar' => 'الحبر',               'primary' => '#1E3A5F', 'secondary' => '#1E3A5F', 'accent' => '#6B7280', 'surface' => '#FAFAFA'],
        ];
    }
}
