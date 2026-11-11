<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class TenantToken extends TenantModel
{
    protected $table = 'tenant_tokens';

    protected $fillable = [
        'user_id',
        'token',
        'name',
        'abilities',
        'last_used_at',
        'expires_at',
    ];

    protected $casts = [
        'last_used_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'user_id');
    }

    /**
     * Generate and hash a new token for the user.
     *
     * @return array{token: TenantToken, plainTextToken: string}
     */
    public static function createTokenFor(
        TenantUser $user,
        string $name = 'auth_token',
        ?int $expiryMinutes = 1440
    ): array {
        $plainToken = Str::random(40);
        $hashedToken = hash('sha256', $plainToken);

        $token = self::create([
            'user_id' => $user->id,
            'token' => $hashedToken,
            'name' => $name,
            'abilities' => json_encode(['*']),
            'expires_at' => $expiryMinutes ? now()->addMinutes($expiryMinutes) : null,
        ]);

        return [
            'token' => $token,
            'plainTextToken' => $plainToken,
        ];
    }

    /**
     * Find a token record by its plain text token representation.
     */
    public static function findToken(string $plainTextToken): ?self
    {
        $hashed = hash('sha256', $plainTextToken);

        $token = \App\Support\Database\PostgresFastPath::enabled('tenant')
            ? \App\Support\Database\PostgresFastPath::tokenWithAuthGraph($hashed)
            : self::with('user.roles.permissions')
                ->where('token', $hashed)
                ->first();

        if (! $token) {
            return null;
        }

        if ($token->expires_at && $token->expires_at->isPast()) {
            return null;
        }

        return $token;
    }
}
