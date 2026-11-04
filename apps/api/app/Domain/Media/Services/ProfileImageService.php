<?php

namespace App\Domain\Media\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Stores course covers and teacher photos. Files live on the private disk under a per-tenant
 * folder and are only ever served through controllers that check visibility — never by raw path.
 */
class ProfileImageService
{
    public const DISK = 'local';

    public const MAX_KB = 3072;

    public const MIMES = 'jpg,jpeg,png,webp';

    public function store(UploadedFile $file, string $tenantSlug, string $kind, ?string $previous = null): string
    {
        $extension = $file->guessExtension() ?: 'jpg';
        $path = $file->storeAs(
            'tenants/'.$tenantSlug.'/images/'.$kind,
            Str::uuid()->toString().'.'.$extension,
            self::DISK
        );

        $this->delete($previous, $tenantSlug);

        return $path;
    }

    public function delete(?string $path, string $tenantSlug): void
    {
        if ($this->isOwnedPath($path, $tenantSlug)) {
            Storage::disk(self::DISK)->delete($path);
        }
    }

    /** A stored path is only trusted when it sits inside this tenant's image folder. */
    public function isOwnedPath(?string $path, string $tenantSlug): bool
    {
        return is_string($path)
            && str_starts_with($path, 'tenants/'.$tenantSlug.'/images/')
            && ! str_contains($path, '..');
    }

    public function response(?string $path, string $tenantSlug)
    {
        if (! $this->isOwnedPath($path, $tenantSlug) || ! Storage::disk(self::DISK)->exists($path)) {
            return null;
        }

        return Storage::disk(self::DISK)->response($path, null, [
            'Cache-Control' => 'public, max-age=300',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
