<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlatformPricing extends Model
{
    use HasUuids;

    protected $table = 'platform_pricing';

    protected $fillable = [
        'tenant_id',
        'student_monthly_fee',
        'currency',
        'receiving_account_type',
        'bank_name',
        'account_holder_name',
        'iban',
        'transfer_instructions',
        'is_active',
    ];

    protected $casts = [
        'student_monthly_fee' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /**
     * Get active pricing for a specific tenant, falling back to platform global default (OD-27).
     */
    public static function getForTenant(?string $tenantId = null): self
    {
        if ($tenantId) {
            $tenantPricing = static::where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->first();
            if ($tenantPricing) {
                return $tenantPricing;
            }
        }

        $default = static::whereNull('tenant_id')
            ->where('is_active', true)
            ->first();

        if (! $default) {
            $default = static::create([
                'tenant_id' => null,
                'student_monthly_fee' => 10.00,
                'currency' => 'SAR',
                'receiving_account_type' => 'platform',
                'bank_name' => 'مصرف الراجحي',
                'account_holder_name' => 'منصة سحابة التعليمية',
                'iban' => 'SA0000000000000000000000',
                'transfer_instructions' => 'يرجى تحويل رسوم الاشتراك الشهري (10 ريال) وإرفاق إشعار التحويل لتفعيل الحساب.',
                'is_active' => true,
            ]);
        }

        return $default;
    }
}
