<?php

namespace Tests\Feature;

use App\Domain\Platform\PlatformMetricsService;
use App\Models\AuditLog;
use App\Models\Course;
use App\Models\PlatformUser;
use App\Models\PublicDirectoryEntry;
use App\Models\Staff;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantMetricSnapshot;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * LANDING-V2 L1 — the public showcase API:
 * - academies appear only after opting in (`tenants.is_listed`), featured first;
 * - teachers keep their own opt-in (PS-2) with paging and filters;
 * - counts come from snapshots, and stay unknown rather than zero when not computed;
 * - the platform console controls listing and featuring, audited;
 * - no contact details or tenant data leak to an unauthenticated caller.
 */
class PublicShowcaseDirectoryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    /** @param array<string, mixed> $attributes */
    private function academy(string $slug, array $attributes = []): Tenant
    {
        return Tenant::create(array_merge([
            'name' => 'أكاديمية '.$slug,
            'slug' => $slug,
            'status' => 'active',
            'type' => 'organization',
            'organization_kind' => 'academy',
            'city' => 'الرياض',
            'contact_phone' => '+966500000000',
            'is_listed' => true,
        ], $attributes));
    }

    private function teacherEntry(Tenant $tenant, string $name, array $attributes = []): PublicDirectoryEntry
    {
        return PublicDirectoryEntry::create(array_merge([
            'tenant_id' => $tenant->id,
            'tenant_slug' => $tenant->slug,
            'tenant_name' => $tenant->name,
            'staff_id' => (string) Str::uuid(),
            'name' => $name,
            'headline' => 'معلم رياضيات',
            'city' => $tenant->city,
            'is_public' => true,
        ], $attributes));
    }

    private function platformHeaders(): array
    {
        $admin = PlatformUser::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@sahaba.test',
            'password' => bcrypt('password123'),
            'role' => 'platform_super_admin',
            'is_active' => true,
        ]);

        return [
            'Authorization' => 'Bearer '.$admin->createToken('test')['plainTextToken'],
            'Accept' => 'application/json',
        ];
    }

    public function test_academies_directory_lists_only_opted_in_active_academies(): void
    {
        $listed = $this->academy('listed-academy');
        $this->academy('hidden-academy', ['is_listed' => false]);
        $this->academy('suspended-academy', ['status' => 'suspended']);

        $res = $this->getJson('/api/v1/public/directory/academies')->assertOk();

        $this->assertSame(['listed-academy'], array_column($res->json('data.academies'), 'slug'));
        $this->assertSame(1, $res->json('meta.pagination.total'));

        // Marketing fields only: no phone, no ids, no tenant data.
        $card = $res->json('data.academies.0');
        $this->assertArrayNotHasKey('contact_phone', $card);
        $this->assertArrayNotHasKey('id', $card);
        $this->assertStringNotContainsString('+966500000000', $res->getContent());
        $this->assertSame('/a/listed-academy', $card['academy_url']);
        $this->assertSame($listed->name, $card['name']);
    }

    public function test_featured_academies_come_first_then_the_most_recently_active(): void
    {
        $quiet = $this->academy('quiet');
        $busy = $this->academy('busy');
        $featured = $this->academy('featured-one', ['is_featured' => true]);

        TenantMetricSnapshot::create(['tenant_id' => $busy->id, 'status' => 'ok', 'last_activity_at' => now()->subDay(), 'computed_at' => now()]);
        TenantMetricSnapshot::create(['tenant_id' => $quiet->id, 'status' => 'ok', 'last_activity_at' => now()->subMonth(), 'computed_at' => now()]);
        TenantMetricSnapshot::create(['tenant_id' => $featured->id, 'status' => 'ok', 'last_activity_at' => null, 'computed_at' => now()]);

        $slugs = array_column($this->getJson('/api/v1/public/directory/academies')->assertOk()->json('data.academies'), 'slug');

        $this->assertSame(['featured-one', 'busy', 'quiet'], $slugs);
    }

    public function test_academies_can_be_filtered_and_paged(): void
    {
        $this->academy('riyadh-center', ['city' => 'الرياض', 'type' => 'organization', 'organization_kind' => 'center']);
        $this->academy('jeddah-tutor', ['city' => 'جدة', 'type' => 'individual_teacher', 'organization_kind' => null]);
        $this->academy('dammam-school', ['city' => 'الدمام', 'type' => 'organization', 'organization_kind' => 'school', 'brand_tagline' => 'تأسيس لغة إنجليزية']);

        $byCity = $this->getJson('/api/v1/public/directory/academies?city='.urlencode('جدة'))->assertOk();
        $this->assertSame(['jeddah-tutor'], array_column($byCity->json('data.academies'), 'slug'));

        $byType = $this->getJson('/api/v1/public/directory/academies?type=individual_teacher')->assertOk();
        $this->assertSame(['jeddah-tutor'], array_column($byType->json('data.academies'), 'slug'));

        $byKind = $this->getJson('/api/v1/public/directory/academies?kind=school')->assertOk();
        $this->assertSame(['dammam-school'], array_column($byKind->json('data.academies'), 'slug'));

        $bySearch = $this->getJson('/api/v1/public/directory/academies?search='.urlencode('إنجليزية'))->assertOk();
        $this->assertSame(['dammam-school'], array_column($bySearch->json('data.academies'), 'slug'));

        $firstPage = $this->getJson('/api/v1/public/directory/academies?per_page=2')->assertOk();
        $this->assertCount(2, $firstPage->json('data.academies'));
        $this->assertSame(['total' => 3, 'page' => 1, 'per_page' => 2, 'last_page' => 2], $firstPage->json('meta.pagination'));

        // per_page is capped, so one request cannot ask for the whole table.
        $capped = $this->getJson('/api/v1/public/directory/academies?per_page=5000')->assertOk();
        $this->assertSame(48, $capped->json('meta.pagination.per_page'));
    }

    public function test_academy_counts_come_from_snapshots_and_stay_unknown_until_computed(): void
    {
        $withCounts = $this->academy('with-counts');
        $this->academy('never-computed');

        TenantMetricSnapshot::create([
            'tenant_id' => $withCounts->id,
            'status' => 'ok',
            'public_courses_count' => 7,
            'public_teachers_count' => 3,
            'computed_at' => now(),
        ]);

        $cards = collect($this->getJson('/api/v1/public/directory/academies')->assertOk()->json('data.academies'))->keyBy('slug');

        $this->assertSame(7, $cards['with-counts']['courses_count']);
        $this->assertSame(3, $cards['with-counts']['teachers_count']);
        $this->assertNull($cards['never-computed']['courses_count']);
        $this->assertNull($cards['never-computed']['teachers_count']);
    }

    public function test_teacher_directory_filters_pages_and_links_to_the_teacher_page(): void
    {
        $alpha = $this->academy('alpha');
        $beta = $this->academy('beta', ['city' => 'جدة']);

        $omar = $this->teacherEntry($alpha, 'عمر الشمري', ['public_courses_count' => 4]);
        $this->teacherEntry($beta, 'سارة القحطاني', ['headline' => 'معلمة كيمياء', 'city' => 'جدة']);
        $this->teacherEntry($alpha, 'مخفي', ['is_public' => false]);

        $all = $this->getJson('/api/v1/public/directory/teachers')->assertOk();
        $this->assertSame(2, $all->json('meta.pagination.total'));

        $byAcademy = $this->getJson('/api/v1/public/directory/teachers?academy=alpha')->assertOk();
        $this->assertCount(1, $byAcademy->json('data.teachers'));
        $card = $byAcademy->json('data.teachers.0');
        $this->assertSame("/a/alpha/teachers/{$omar->staff_id}", $card['profile_url']);
        $this->assertSame('/a/alpha', $card['academy_url']);
        $this->assertSame(4, $card['courses_count']);

        $byCity = $this->getJson('/api/v1/public/directory/teachers?city='.urlencode('جدة'))->assertOk();
        $this->assertSame(['سارة القحطاني'], array_column($byCity->json('data.teachers'), 'name'));

        $bySearch = $this->getJson('/api/v1/public/directory/teachers?search='.urlencode('كيمياء'))->assertOk();
        $this->assertCount(1, $bySearch->json('data.teachers'));

        $paged = $this->getJson('/api/v1/public/directory/teachers?per_page=1')->assertOk();
        $this->assertCount(1, $paged->json('data.teachers'));
        $this->assertSame(2, $paged->json('meta.pagination.last_page'));
    }

    public function test_a_teacher_keeps_their_own_opt_in_even_if_the_academy_is_not_listed(): void
    {
        $unlisted = $this->academy('unlisted', ['is_listed' => false]);
        $this->teacherEntry($unlisted, 'معلم مستقل');

        $this->getJson('/api/v1/public/directory/academies')->assertOk()->assertJsonCount(0, 'data.academies');
        $this->getJson('/api/v1/public/directory/teachers')->assertOk()->assertJsonCount(1, 'data.teachers');
    }

    public function test_public_stats_counts_listed_academies_and_hides_uncomputed_numbers(): void
    {
        $one = $this->academy('one');
        $this->academy('two', ['city' => 'جدة']);
        $this->academy('not-listed', ['is_listed' => false]);
        $this->teacherEntry($one, 'معلم');

        $empty = $this->getJson('/api/v1/public/stats')->assertOk();
        $this->assertSame(2, $empty->json('data.academies_count'));
        $this->assertSame(1, $empty->json('data.teachers_count'));
        $this->assertSame(2, $empty->json('data.cities_count'));
        $this->assertNull($empty->json('data.courses_count'), 'courses stay unknown before any snapshot');

        Cache::flush();
        TenantMetricSnapshot::create(['tenant_id' => $one->id, 'status' => 'ok', 'public_courses_count' => 5, 'computed_at' => now()]);

        $this->getJson('/api/v1/public/stats')->assertOk()->assertJsonPath('data.courses_count', 5);
    }

    public function test_platform_console_controls_listing_and_featuring_with_an_audit_trail(): void
    {
        $academy = $this->academy('to-toggle', ['is_listed' => false]);
        $headers = $this->platformHeaders();

        $this->getJson('/api/v1/platform/directory/academies')->assertUnauthorized();

        // Featuring an academy that is not listed would change nothing public.
        $this->postJson("/api/v1/platform/directory/academies/{$academy->id}/toggle", ['field' => 'is_featured', 'value' => true], $headers)
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ACADEMY_NOT_LISTED');

        $this->postJson("/api/v1/platform/directory/academies/{$academy->id}/toggle", ['field' => 'is_listed', 'value' => true], $headers)
            ->assertOk()
            ->assertJsonPath('data.academy.is_listed', true);

        $this->postJson("/api/v1/platform/directory/academies/{$academy->id}/toggle", ['field' => 'is_featured', 'value' => true], $headers)
            ->assertOk()
            ->assertJsonPath('data.academy.is_featured', true);

        // Unlisting also removes the featured place.
        $this->postJson("/api/v1/platform/directory/academies/{$academy->id}/toggle", ['field' => 'is_listed', 'value' => false], $headers)
            ->assertOk();

        $academy->refresh();
        $this->assertFalse($academy->is_listed);
        $this->assertFalse($academy->is_featured);
        $this->assertSame(3, AuditLog::where('action', 'platform.directory.academy_updated')->count());

        $listing = $this->getJson('/api/v1/platform/directory/academies', $headers)->assertOk();
        $this->assertSame('to-toggle', $listing->json('data.academies.0.slug'));
        $this->assertFalse($listing->json('data.academies.0.is_listed'));
    }

    public function test_metrics_refresh_fills_public_counts_from_the_tenant_database(): void
    {
        $tenant = $this->academy('counted');
        TenantDatabase::create([
            'tenant_id' => $tenant->id,
            'connection_identifier' => 'tenant_counted_'.uniqid(),
            'status' => 'ready',
        ]);

        $databases = app(TenantDatabaseManager::class);
        $databases->migrateTenant($tenant);
        $databases->configureConnection($tenant);
        app(TenantContext::class)->setTenant($tenant);

        $user = TenantUser::create([
            'name' => 'معلمة أحياء',
            'email' => 'bio@counted.test',
            'password' => bcrypt('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $staff = Staff::create(['user_id' => $user->id, 'staff_type' => 'teacher', 'status' => 'active', 'is_public' => true]);

        Course::create(['code' => 'PUB-1', 'title' => 'منشور وعام', 'status' => 'published', 'is_public' => true, 'teacher_staff_id' => $staff->id]);
        Course::create(['code' => 'PUB-2', 'title' => 'منشور وعام ٢', 'status' => 'published', 'is_public' => true, 'teacher_staff_id' => $staff->id]);
        Course::create(['code' => 'DRAFT', 'title' => 'مسودة', 'status' => 'draft', 'is_public' => true, 'teacher_staff_id' => $staff->id]);
        Course::create(['code' => 'PRIVATE', 'title' => 'غير معروض', 'status' => 'published', 'is_public' => false, 'teacher_staff_id' => $staff->id]);

        $entry = $this->teacherEntry($tenant, 'معلمة أحياء', ['staff_id' => (string) $staff->id]);

        app(PlatformMetricsService::class)->refreshTenant($tenant->fresh());

        $snapshot = TenantMetricSnapshot::findOrFail($tenant->id);
        $this->assertSame('ok', $snapshot->status);
        $this->assertSame(2, $snapshot->public_courses_count, 'only published + public courses count');
        $this->assertSame(1, $snapshot->public_teachers_count);
        $this->assertSame(4, $snapshot->courses_count);
        $this->assertSame(2, $entry->fresh()->public_courses_count);
    }
}
