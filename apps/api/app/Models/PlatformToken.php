<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class PlatformToken extends Model
{
    protected $table = 'platform_tokens';

    protected $fillable = [
        'user_id',
        'token_hash',
        'name',
        'last_used_at',
        'expires_at',
    ];

    protected $casts = [
        'last_used_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(PlatformUser::class, 'user_id');
    }

    /**
     * Generate and hash a new platform token.
     *
     * @return array{token: PlatformToken, plainTextToken: string}
     */
    public static function createTokenFor(
        PlatformUser $user,
        string $name = 'platform_token',
        ?int $expiryMinutes = 1440
    ): array {
        $plainToken = 'plt_'.Str::random(40);
        $hashedToken = hash('sha256', $plainToken);

        $token = self::create([
            'user_id' => $user->id,
            'token_hash' => $hashedToken,
            'name' => $name,
            'expires_at' => $expiryMinutes ? now()->addMinutes($expiryMinutes) : null,
        ]);

        return [
            'token' => $token,
            'plainTextToken' => $plainToken,
        ];
    }

    /**
     * Look up a valid token by its plain text representation.
     */
    public static function findToken(string $plainTextToken): ?self
    {
        $hashed = hash('sha256', $plainTextToken);

        $token = self::with('user.roles')
            ->where('token_hash', $hashed)
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
