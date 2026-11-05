<?php

namespace App\Domain\PublicDirectory\Services;

use App\Models\PublicDirectoryEntry;
use App\Models\Staff;
use App\Models\Tenant;

class PublicDirectorySyncService
{
    /**
     * Synchronize opted-in teacher public profile into the platform-wide public directory.
     * If the teacher opted out or is inactive, their entry is removed from the directory.
     */
    public function syncStaff(Tenant $tenant, Staff $staff): ?PublicDirectoryEntry
    {
        if (! $staff->is_public || $staff->status !== 'active') {
            $this->removeStaff($tenant->id, $staff->id);

            return null;
        }

        $user = $staff->relationLoaded('user') ? $staff->user : $staff->user()->first();
        if (! $user) {
            $this->removeStaff($tenant->id, $staff->id);

            return null;
        }

        $v = $staff->photo_path ? substr(md5($staff->photo_path), 0, 8) : null;
        $photoUrl = $staff->photo_path
            ? "/api/v1/public/academy/teachers/{$staff->id}/image?tenant={$tenant->slug}".($v ? "&v={$v}" : '')
            : null;

        $city = $tenant->brand_settings['city'] ?? $tenant->city ?? null;

        return PublicDirectoryEntry::updateOrCreate(
            [
                'tenant_id' => $tenant->id,
                'staff_id' => (string) $staff->id,
            ],
            [
                'tenant_slug' => $tenant->slug,
                'tenant_name' => $tenant->name,
                'name' => $user->name,
                'headline' => $staff->headline,
                'bio' => $staff->public_bio,
                'photo_url' => $photoUrl,
                'city' => $city,
                'is_public' => true,
            ]
        );
    }

    /**
     * Remove a teacher entry from the public directory.
     */
    public function removeStaff(string $tenantId, string $staffId): void
    {
        PublicDirectoryEntry::where('tenant_id', $tenantId)->where('staff_id', (string) $staffId)->delete();
    }
}
