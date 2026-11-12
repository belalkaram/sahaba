<?php

namespace App\Models;

/**
 * Per-tenant key/value settings stored in the tenant database.
 */
class TenantSetting extends TenantModel
{
    public const NOTIFY_PARENTS_ON_ABSENCE = 'notify_parents_on_absence';

    public const AT_RISK_ATTENDANCE_BELOW = 'at_risk_attendance_below';

    public const AT_RISK_SCORE_BELOW = 'at_risk_score_below';

    /** OD-35: minimum attendance % in a course to sit its exams; null = no rule (the academy chooses). */
    public const MIN_ATTENDANCE_FOR_EXAMS = 'min_attendance_for_exams';

    public const WHATSAPP_ENABLED = 'whatsapp_enabled';

    public const WHATSAPP_PHONE_NUMBER_ID = 'whatsapp_phone_number_id';

    public const WHATSAPP_ACCESS_TOKEN = 'whatsapp_access_token';

    public const WHATSAPP_EVENTS = 'whatsapp_events';

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['key', 'value'];

    protected $casts = ['value' => 'array'];

    public static function getValue(string $key, mixed $default = null): mixed
    {
        $row = static::query()->find($key);

        return $row ? ($row->value['v'] ?? $default) : $default;
    }

    public static function setValue(string $key, mixed $value): void
    {
        static::query()->updateOrCreate(['key' => $key], ['value' => ['v' => $value]]);
    }
}
