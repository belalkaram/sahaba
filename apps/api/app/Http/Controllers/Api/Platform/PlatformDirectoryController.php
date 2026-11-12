<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\PublicDirectoryEntry;
use App\Models\Tenant;
use App\Models\TenantMetricSnapshot;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

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
     * Academies with their public-directory state, for the platform console.
     */
    public function academies(Request $request): JsonResponse
    {
        $query = Tenant::query()->orderByDesc('is_featured')->orderBy('name');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('slug', 'like', "%{$search}%"));
        }

        $page = $query->paginate(20);
        $snapshots = TenantMetricSnapshot::whereIn('tenant_id', collect($page->items())->pluck('id'))->get()->keyBy('tenant_id');

        return ApiResponse::success([
            'academies' => collect($page->items())->map(fn (Tenant $t) => [
                'id' => $t->id,
                'slug' => $t->slug,
                'name' => $t->name,
                'type' => $t->type,
                'city' => $t->city,
                'status' => $t->status,
                'is_listed' => (bool) $t->is_listed,
                'is_featured' => (bool) $t->is_featured,
                'public_courses_count' => $snapshots->get($t->id)?->public_courses_count,
                'public_teachers_count' => $snapshots->get($t->id)?->public_teachers_count,
            ])->values(),
            'pagination' => [
                'total' => $page->total(),
                'page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'last_page' => $page->lastPage(),
            ],
        ]);
    }

    /**
     * Switch an academy's public-directory listing or its featured place (Super Admin).
     * Featuring an academy that is not listed would change nothing public, so it is refused.
     */
    public function toggleAcademy(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'field' => 'required|string|in:is_listed,is_featured',
            'value' => 'required|boolean',
        ]);

        $tenant = Tenant::findOrFail($id);
        $value = (bool) $validated['value'];

        if ($validated['field'] === 'is_featured' && $value && ! $tenant->is_listed) {
            return ApiResponse::error(
                'ACADEMY_NOT_LISTED',
                'لا يمكن تمييز أكاديمية غير معروضة في الدليل العام.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $tenant->update([$validated['field'] => $value]);
        // The landing's numbers are cached; a listing change must show up at once.
        Cache::forget('public.stats');

        // Removing an academy from the directory also drops its featured place.
        if ($validated['field'] === 'is_listed' && ! $value && $tenant->is_featured) {
            $tenant->update(['is_featured' => false]);
        }

        AuditLogger::log(
            action: 'platform.directory.academy_updated',
            tenantId: $tenant->id,
            entityType: 'Tenant',
            entityId: $tenant->id,
            payload: ['is_listed' => $tenant->is_listed, 'is_featured' => $tenant->is_featured]
        );

        return ApiResponse::success([
            'academy' => ['id' => $tenant->id, 'is_listed' => (bool) $tenant->is_listed, 'is_featured' => (bool) $tenant->is_featured],
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
