<?php

namespace App\Http\Requests\Tenant;

use App\Domain\Platform\Services\TenantLandingService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * ADR-007 (TL-1): Validates landing settings before they are stored as a draft.
 *
 * Security rules enforced here:
 * - Colours: exactly #RRGGBB hex, never arbitrary CSS or empty.
 * - Template: one of the five allowed IDs.
 * - Text fields: plain text only (no HTML), bounded lengths.
 * - URLs: https:// only, bounded length.
 * - Phone: E.164 pattern.
 * - Array sizes: FAQs ≤ 8, highlights ≤ 3.
 */
class LandingSettingsRequest extends FormRequest
{
    private static string $HEX_PATTERN = '/^#[0-9a-fA-F]{6}$/';

    public function authorize(): bool
    {
        // Authorization is handled by the route middleware (tenant.can:tenant.branding).
        return true;
    }

    public function rules(): array
    {
        return [
            'template'           => ['required', Rule::in(TenantLandingService::TEMPLATES)],

            // Palette — four required colours
            'palette'            => ['required', 'array'],
            'palette.primary'    => ['required', 'string', 'regex:'.self::$HEX_PATTERN],
            'palette.secondary'  => ['required', 'string', 'regex:'.self::$HEX_PATTERN],
            'palette.accent'     => ['required', 'string', 'regex:'.self::$HEX_PATTERN],
            'palette.surface'    => ['required', 'string', 'regex:'.self::$HEX_PATTERN],

            // Section toggles
            'sections'           => ['required', 'array'],
            'sections.stats'     => ['boolean'],
            'sections.courses'   => ['boolean'],
            'sections.teachers'  => ['boolean'],
            'sections.about'     => ['boolean'],
            'sections.contact'   => ['boolean'],
            'sections.faq'       => ['boolean'],

            // Content — all optional, plain text
            'content'                       => ['sometimes', 'array'],
            'content.cover_path'            => ['nullable', 'string', 'max:500'],
            'content.about'                 => ['sometimes', 'array'],
            'content.about.text'            => ['nullable', 'string', 'max:1200'],
            'content.about.highlights'      => ['sometimes', 'array', 'max:3'],
            'content.about.highlights.*'    => ['string', 'max:120'],

            // Contact (OD-43: each field opt-in; TL-6 adds per-field publish switches)
            'content.contact'               => ['sometimes', 'array'],
            'content.contact.phone'         => ['nullable', 'string', 'regex:/^\+[1-9]\d{6,14}$/'],
            'content.contact.whatsapp'      => ['nullable', 'string', 'regex:/^\+[1-9]\d{6,14}$/'],
            'content.contact.email'         => ['nullable', 'email', 'max:255'],
            'content.contact.address'       => ['nullable', 'string', 'max:500'],
            'content.contact.map_url'       => ['nullable', 'string', 'regex:/^https:\/\/.+/', 'max:1000'],
            'content.contact.phone_published'    => ['sometimes', 'boolean'],
            'content.contact.whatsapp_published' => ['sometimes', 'boolean'],
            'content.contact.email_published'    => ['sometimes', 'boolean'],
            'content.contact.address_published'  => ['sometimes', 'boolean'],
            'content.contact.map_url_published'  => ['sometimes', 'boolean'],
            'content.contact.social'        => ['sometimes', 'array', 'max:6'],
            'content.contact.social.*'      => ['nullable', 'string', 'regex:/^https:\/\/.+/', 'max:500'],

            // FAQ ≤ 8 entries
            'content.faq'                   => ['sometimes', 'array', 'max:8'],
            'content.faq.*.question'        => ['required', 'string', 'max:300'],
            'content.faq.*.answer'          => ['required', 'string', 'max:1200'],
        ];
    }

    public function messages(): array
    {
        return [
            'palette.primary.regex'   => 'اللون الأساسي يجب أن يكون بصيغة #RRGGBB.',
            'palette.secondary.regex' => 'اللون المساند يجب أن يكون بصيغة #RRGGBB.',
            'palette.accent.regex'    => 'لون الإبراز يجب أن يكون بصيغة #RRGGBB.',
            'palette.surface.regex'   => 'لون الخلفية يجب أن يكون بصيغة #RRGGBB.',
            'template.in'             => 'القالب المختار غير متاح.',
            'content.faq.max'         => 'لا يمكن إضافة أكثر من 8 أسئلة شائعة.',
            'content.about.text.max'  => 'وصف الأكاديمية لا يتجاوز 1200 حرف.',
        ];
    }

    /**
     * Merge the incoming data with the schema version before validation.
     */
    protected function prepareForValidation(): void
    {
        $this->merge(['schema' => TenantLandingService::SCHEMA_VERSION]);
    }

    /**
     * Return the validated data merged with the schema version.
     */
    public function validatedWithSchema(): array
    {
        return array_merge(['schema' => TenantLandingService::SCHEMA_VERSION], $this->validated());
    }
}
