<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Platform-wide setting stored in the Control DB (R7F, OD-20).
 */
class PlatformSetting extends Model
{
    public const DEMO_LOGIN_ENABLED = 'demo_login_enabled';

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['key', 'value', 'updated_by'];

    protected $casts = ['value' => 'array'];

    public static function getValue(string $key, mixed $default = null): mixed
    {
        $row = static::query()->find($key);

        return $row ? ($row->value['v'] ?? $default) : $default;
    }

    public static function setValue(string $key, mixed $value, ?string $updatedBy = null): void
    {
        static::query()->updateOrCreate(
            ['key' => $key],
            ['value' => ['v' => $value], 'updated_by' => $updatedBy]
        );
    }
}
