<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\PublicDirectoryEntry;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformDirectoryController extends Controller
{
    /**
     * List all public directory entries for platform administrators.
     */
    public function index(Request $request): JsonResponse
    {
        $query = PublicDirectoryEntry::query()
            ->orderByDesc('is_featured')
            ->orderBy('sort_order')
            ->orderByDesc('updated_at');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('headline', 'like', "%{$search}%")
                    ->orWhere('tenant_name', 'like', "%{$search}%")
                    ->orWhere('tenant_slug', 'like', "%{$search}%");
            });
        }

        return ApiResponse::success([
            'entries' => $query->paginate(20),
        ]);
    }

    /**
     * Toggle featured status for a directory entry (Super Admin).
     */
    public function toggleFeatured(int $id): JsonResponse
    {
        $entry = PublicDirectoryEntry::findOrFail($id);
        $entry->update(['is_featured' => ! $entry->is_featured]);

        AuditLogger::log(
            action: 'platform.directory.featured_toggled',
            tenantId: $entry->tenant_id,
            entityType: 'PublicDirectoryEntry',
            entityId: (string) $entry->id,
            payload: ['is_featured' => $entry->is_featured]
        );

        return ApiResponse::success([
            'entry' => $entry,
            'message' => $entry->is_featured ? 'تم تمييز المعلم في الصفحة الرئيسية' : 'تم إلغاء تمييز المعلم',
        ]);
    }
}
