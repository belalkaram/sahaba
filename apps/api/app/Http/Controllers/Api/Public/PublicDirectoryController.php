<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\PublicDirectoryEntry;
use App\Models\Tenant;
use App\Models\TenantMetricSnapshot;
use App\Support\ApiResponse;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * Unauthenticated public showcase: the academies and teachers who opted in, plus the headline
 * numbers on the landing page (LANDING-V2 L1).
 *
 * Only opt-in marketing fields are exposed: an academy appears when `tenants.is_listed` is on, a
 * teacher when their profile is public. Contact details, ids of users and any tenant data stay out.
 * Counts come from `tenant_metric_snapshots`, so no request here opens a tenant database.
 */
class PublicDirectoryController extends Controller
{
    private const PER_PAGE_DEFAULT = 12;

    private const PER_PAGE_MAX = 48;

    /**
     * Opted-in teachers, featured first. A teacher's own opt-in is enough (PS-2): the academy's
     * `is_listed` governs the academies directory, it does not override a teacher's consent.
     */
    public function teachers(Request $request): JsonResponse
    {
        $query = PublicDirectoryEntry::query()
            ->where('is_public', true)
            ->whereHas('tenant', fn ($q) => $q->where('status', 'active'));

        if ($request->boolean('featured')) {
            $query->where('is_featured', true);
        }

        if ($slug = $this->trimmed($request, 'academy')) {
            $query->where('tenant_slug', $slug);
        }

        if ($city = $this->trimmed($request, 'city')) {
            $query->where('city', 'like', "%{$city}%");
        }

        if ($search = $this->trimmed($request, 'search')) {
            $query->where(function (Builder $q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('headline', 'like', "%{$search}%")
                    ->orWhere('tenant_name', 'like', "%{$search}%");
            });
        }

        $page = $query
            ->orderByDesc('is_featured')
            ->orderBy('sort_order')
            ->orderByDesc('updated_at')
            ->paginate($this->perPage($request));

        return ApiResponse::success(
            ['teachers' => collect($page->items())->map(fn (PublicDirectoryEntry $e) => [
                'id' => $e->id,
                'staff_id' => $e->staff_id,
                'tenant_slug' => $e->tenant_slug,
                'tenant_name' => $e->tenant_name,
                'name' => $e->name,
                'headline' => $e->headline,
                'bio' => $e->bio,
                'photo_url' => $e->photo_url,
                'city' => $e->city,
                'courses_count' => $e->public_courses_count,
                'is_featured' => (bool) $e->is_featured,
                'profile_url' => "/a/{$e->tenant_slug}/teachers/{$e->staff_id}",
                'academy_url' => "/a/{$e->tenant_slug}",
            ])->values()],
            200,
            ['pagination' => $this->pagination($page)]
        );
    }

    /** Academies that opted into the public directory. */
    public function academies(Request $request): JsonResponse
    {
        $query = Tenant::query()
            ->with('features')
            ->leftJoin('tenant_metric_snapshots as snapshots', 'snapshots.tenant_id', '=', 'tenants.id')
            ->where('tenants.status', 'active')
            ->where('tenants.is_listed', true)
            ->select([
                'tenants.*',
                'snapshots.public_courses_count',
                'snapshots.public_teachers_count',
                'snapshots.last_activity_at',
            ]);

        if ($request->boolean('featured')) {
            $query->where('tenants.is_featured', true);
        }

        if ($city = $this->trimmed($request, 'city')) {
            $query->where('tenants.city', 'like', "%{$city}%");
        }

        if (in_array($type = (string) $request->query('type'), ['individual_teacher', 'organization'], true)) {
            $query->where('tenants.type', $type);
        }

        if (in_array($kind = (string) $request->query('kind'), ['center', 'academy', 'school', 'institute'], true)) {
            $query->where('tenants.organization_kind', $kind);
        }

        // OD-31: a tenant takes the online service, the offline one, or both.
        if (in_array($service = (string) $request->query('service'), ['online', 'offline'], true)) {
            $keys = $service === 'online' ? ['online', 'courses'] : ['offline', 'attendance'];
            $query->whereHas('features', fn ($q) => $q->whereIn('feature_key', $keys)->where('enabled', true));
        }

        if ($search = $this->trimmed($request, 'search')) {
            $query->where(function (Builder $q) use ($search) {
                $q->where('tenants.name', 'like', "%{$search}%")
                    ->orWhere('tenants.city', 'like', "%{$search}%")
                    ->orWhere('tenants.brand_tagline', 'like', "%{$search}%");
            });
        }

        $page = $query
            ->orderByDesc('tenants.is_featured')
            // Academies that never had activity go last on every database (no NULLS LAST needed).
            ->orderByRaw('CASE WHEN snapshots.last_activity_at IS NULL THEN 1 ELSE 0 END')
            ->orderByDesc('snapshots.last_activity_at')
            ->orderBy('tenants.name')
            ->paginate($this->perPage($request));

        return ApiResponse::success(
            ['academies' => collect($page->items())->map(fn (Tenant $t) => $this->academyCard($t))->values()],
            200,
            ['pagination' => $this->pagination($page)]
        );
    }

    /**
     * Headline numbers for the landing page. Cached briefly; a count stays null while it has not
     * been computed, so the page can hide it instead of showing a zero that is not true.
     */
    public function stats(): JsonResponse
    {
        return ApiResponse::success(Cache::remember('public.stats', now()->addMinutes(10), function () {
            $activeIds = Tenant::where('status', 'active')->pluck('id');
            $listedIds = Tenant::where('status', 'active')->where('is_listed', true)->pluck('id');
            $computed = TenantMetricSnapshot::whereIn('tenant_id', $listedIds)->get()->where('status', 'ok');

            return [
                'academies_count' => $listedIds->count(),
                'teachers_count' => PublicDirectoryEntry::where('is_public', true)
                    ->whereIn('tenant_id', $activeIds)->count(),
                'courses_count' => $this->sumOrNull($computed, 'public_courses_count'),
                'cities_count' => Tenant::where('status', 'active')->where('is_listed', true)
                    ->whereNotNull('city')->distinct()->count('city'),
                'computed_at' => $computed->max('computed_at')?->toIso8601String(),
            ];
        }));
    }

    /** @return array<string, mixed> */
    private function academyCard(Tenant $tenant): array
    {
        $logoPath = $tenant->brand_settings['logo_path'] ?? null;

        return [
            'slug' => $tenant->slug,
            'name' => $tenant->name,
            'type' => $tenant->type,
            'organization_kind' => $tenant->organization_kind,
            'city' => $tenant->city,
            'tagline' => $tenant->brand_tagline,
            'logo_url' => $logoPath
                ? '/api/v1/public/academy/logo?tenant='.$tenant->slug.'&v='.substr(md5($logoPath), 0, 8)
                : $tenant->logo_url,
            'primary_color' => $tenant->primary_color,
            'services' => $tenant->services,
            'courses_count' => $tenant->public_courses_count !== null ? (int) $tenant->public_courses_count : null,
            'teachers_count' => $tenant->public_teachers_count !== null ? (int) $tenant->public_teachers_count : null,
            'accepts_registrations' => (bool) $tenant->accepts_registrations,
            'is_featured' => (bool) $tenant->is_featured,
            'academy_url' => "/a/{$tenant->slug}",
        ];
    }

    private function trimmed(Request $request, string $key): ?string
    {
        $value = trim((string) $request->query($key, ''));

        return $value === '' ? null : mb_substr($value, 0, 80);
    }

    private function perPage(Request $request): int
    {
        $value = (int) $request->query('per_page', (string) self::PER_PAGE_DEFAULT);

        return max(1, min($value ?: self::PER_PAGE_DEFAULT, self::PER_PAGE_MAX));
    }

    /**
     * @param  LengthAwarePaginator<int, mixed>  $page
     * @return array<string, int>
     */
    private function pagination($page): array
    {
        return [
            'total' => $page->total(),
            'page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'last_page' => $page->lastPage(),
        ];
    }

    /** @param  Collection<int, TenantMetricSnapshot>  $snapshots */
    private function sumOrNull($snapshots, string $column): ?int
    {
        $values = $snapshots->pluck($column)->filter(fn ($v) => $v !== null);

        return $values->isEmpty() ? null : (int) $values->sum();
    }
}
