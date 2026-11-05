<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\PublicDirectoryEntry;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicDirectoryController extends Controller
{
    /**
     * Unauthenticated public directory of teachers for the platform landing page.
     * Only returns entries from active tenants with opt-in public status.
     */
    public function teachers(Request $request): JsonResponse
    {
        $query = PublicDirectoryEntry::query()
            ->where('is_public', true)
            ->whereHas('tenant', fn ($q) => $q->where('status', 'active'));

        if ($request->boolean('featured')) {
            $query->where('is_featured', true);
        }

        $entries = $query
            ->orderByDesc('is_featured')
            ->orderBy('sort_order')
            ->orderByDesc('updated_at')
            ->limit(30)
            ->get();

        return ApiResponse::success([
            'teachers' => $entries->map(fn (PublicDirectoryEntry $e) => [
                'id' => $e->id,
                'staff_id' => $e->staff_id,
                'tenant_slug' => $e->tenant_slug,
                'tenant_name' => $e->tenant_name,
                'name' => $e->name,
                'headline' => $e->headline,
                'bio' => $e->bio,
                'photo_url' => $e->photo_url,
                'city' => $e->city,
                'is_featured' => (bool) $e->is_featured,
                'academy_url' => "/a/{$e->tenant_slug}/teachers",
            ])->values(),
        ]);
    }
}
