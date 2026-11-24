<?php

namespace App\Http\Controllers\Api\Billing;

use App\Http\Controllers\Controller;
use App\Models\TenantSetting;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * How students pay this academy for its packages (OD-34, PAY-SET-1).
 *
 * Stored per academy in the tenant database. Nothing is configured by default: until the academy
 * chooses its methods, students see no payment method and cannot submit a payment (fail closed).
 */
class PaymentSettingsController extends Controller
{
    public const METHODS = ['bank_transfer', 'instapay', 'cash'];

    private const DEFAULTS = [
        'accepted_methods' => [],
        'bank_name' => null,
        'account_holder_name' => null,
        'iban' => null,
        'instapay_address' => null,
        'instructions' => null,
    ];

    /**
     * GET /billing/payment-settings — any signed-in user of the academy (students need it to pay).
     */
    public function show(): JsonResponse
    {
        return ApiResponse::success(self::current());
    }

    /**
     * PUT /billing/payment-settings — tenant.settings.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'accepted_methods' => 'present|array',
            'accepted_methods.*' => ['string', 'distinct', Rule::in(self::METHODS)],
            'bank_name' => 'nullable|string|max:100',
            'account_holder_name' => 'nullable|string|max:150',
            'iban' => 'nullable|string|max:50',
            'instapay_address' => 'nullable|string|max:100',
            'instructions' => 'nullable|string|max:1000',
        ]);

        $methods = array_values($validated['accepted_methods']);
        $errors = [];
        if (in_array('bank_transfer', $methods, true) && empty($validated['iban'])) {
            $errors['iban'] = ['أدخل رقم الآيبان لتفعيل التحويل البنكي.'];
        }
        if (in_array('instapay', $methods, true) && empty($validated['instapay_address'])) {
            $errors['instapay_address'] = ['أدخل عنوان إنستاباي لتفعيل الدفع عبره.'];
        }
        if ($errors) {
            return ApiResponse::error('VALIDATION_ERROR', 'بيانات وسيلة الدفع غير مكتملة.', 422, $errors);
        }

        $settings = array_merge(self::DEFAULTS, $validated, ['accepted_methods' => $methods]);
        TenantSetting::setValue(TenantSetting::PAYMENT_SETTINGS, $settings);

        AuditLogger::log(
            action: 'tenant.payment_settings.updated',
            entityType: 'TenantSetting',
            entityId: TenantSetting::PAYMENT_SETTINGS,
            payload: ['accepted_methods' => $methods],
        );

        return ApiResponse::success(self::current());
    }

    /**
     * @return array{accepted_methods: list<string>, bank_name: ?string, account_holder_name: ?string, iban: ?string, instapay_address: ?string, instructions: ?string}
     */
    public static function current(): array
    {
        $stored = TenantSetting::getValue(TenantSetting::PAYMENT_SETTINGS, []);

        return array_merge(self::DEFAULTS, is_array($stored) ? array_intersect_key($stored, self::DEFAULTS) : []);
    }

    public static function accepts(string $method): bool
    {
        return in_array($method, self::current()['accepted_methods'], true);
    }
}
