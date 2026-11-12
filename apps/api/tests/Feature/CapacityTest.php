<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Domain\Platform\Capacity\TenantCapacityService;
use App\Models\AccessCredential;
use App\Models\CapacityRequest;
use App\Models\PlatformRole;
use App\Models\PlatformUser;
use App\Models\Role;
use App\Models\Student;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/** ADR-006 / OD-38, OD-39 (CAP-1): seat = code, academy requests, super admin grants. */
class CapacityTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private TenantUser $owner;

    private string $ownerToken;

    private string $platformToken;

    protected function setUp(): void
    {
        parent::setUp();
        config(['platform.capacity_enforced' => true]);
        Storage::fake('local');

        $slug = 'cap-'.strtolower(Str::random(6));
        $this->tenant = Tenant::create(['name' => 'Cap Academy', 'slug' => $slug, 'status' => 'active']);
        TenantDatabase::create(['tenant_id' => $this->tenant->id, 'connection_identifier' => 'tenant_'.$slug, 'status' => 'ready']);
        $db = app(TenantDatabaseManager::class);
        $db->migrateTenant($this->tenant);
        app(TenantContext::class)->setTenant($this->tenant);
        $db->configureConnection($this->tenant);
        app(RoleSynchronizer::class)->sync();

        $this->owner = TenantUser::create(['name' => 'Owner', 'email' => 'owner@cap.test', 'password' => bcrypt('x'), 'type' => 'staff', 'status' => 'active']);
        $this->owner->roles()->attach(Role::where('name', 'owner')->firstOrFail()->id);
        $this->ownerToken = TenantToken::createTokenFor($this->owner)['plainTextToken'];

        $role = PlatformRole::firstOrCreate(['name' => 'platform_super_admin'], ['label' => 'Super', 'description' => 'All']);
        $admin = PlatformUser::create(['name' => 'Super', 'email' => 'super@cap.test', 'password' => Hash::make('CapSecret2026!'), 'status' => 'active']);
        $admin->roles()->attach($role->id);
        $this->platformToken = $this->postJson('/api/v1/platform/auth/login', ['email' => 'super@cap.test', 'password' => 'CapSecret2026!'])->assertOk()->json('data.token');
    }

    private function asOwner()
    {
        return $this->withHeaders(['X-Tenant-Slug' => $this->tenant->slug, 'Authorization' => 'Bearer '.$this->ownerToken]);
    }

    private function asPlatform()
    {
        return $this->withHeaders(['Authorization' => 'Bearer '.$this->platformToken]);
    }

    private function createStudent(string $tag)
    {
        return $this->asOwner()->postJson('/api/v1/students', ['name' => "Student $tag", 'parent_name' => "Parent $tag", 'parent_phone' => '05'.str_pad((string) crc32($tag) % 100000000, 8, '0', STR_PAD_LEFT)]);
    }

    private function setQuota(int $quota): void
    {
        $this->tenant->forceFill(['seat_quota' => $quota])->save();
        app(TenantContext::class)->setTenant($this->tenant->fresh());
    }

    public function test_students_stop_at_the_quota(): void
    {
        $this->setQuota(2);

        $this->createStudent('a')->assertCreated();
        $this->createStudent('b')->assertCreated();
        $this->createStudent('c')->assertStatus(409)
            ->assertJsonPath('error.code', 'CAPACITY_EXCEEDED')
            ->assertJsonPath('error.details.used', 2)
            ->assertJsonPath('error.details.quota', 2);

        $this->asOwner()->getJson('/api/v1/tenant/capacity')->assertOk()
            ->assertJsonPath('data.capacity.used', 2)->assertJsonPath('data.capacity.available', 0);
    }

    public function test_first_code_is_free_a_second_device_takes_a_seat_and_revoking_frees_it(): void
    {
        $this->setQuota(2);
        $id = $this->createStudent('a')->assertCreated()->json('data.student.id');
        $student = Student::findOrFail($id);
        $service = app(TenantCapacityService::class);

        $this->asOwner()->postJson('/api/v1/credentials', ['student_id' => $id])->assertCreated();
        $this->assertSame(1, $service->used(), 'the first code uses the student\'s own seat');

        $this->asOwner()->postJson('/api/v1/credentials', ['student_id' => $id])->assertCreated();
        $this->assertSame(2, $service->used(), 'a second device takes another seat');

        $this->asOwner()->postJson('/api/v1/credentials', ['student_id' => $id])->assertStatus(409)->assertJsonPath('error.code', 'CAPACITY_EXCEEDED');
        $this->createStudent('b')->assertStatus(409);

        AccessCredential::where('student_id', $student->id)->latest('issued_at')->first()->update(['status' => 'revoked', 'revoked_at' => now()]);
        $this->assertSame(1, $service->used());
        $this->createStudent('b')->assertCreated();
    }

    public function test_an_academy_without_a_quota_starts_at_its_current_usage(): void
    {
        config(['platform.capacity_enforced' => false]);
        $this->createStudent('a')->assertCreated();
        $this->createStudent('b')->assertCreated();
        config(['platform.capacity_enforced' => true]);

        $this->assertNull($this->tenant->fresh()->seat_quota);
        $this->createStudent('c')->assertStatus(409);
        $this->assertSame(2, $this->tenant->fresh()->seat_quota);
    }

    public function test_academy_requests_and_super_admin_grants(): void
    {
        $this->setQuota(1);
        $this->createStudent('a')->assertCreated();

        $proof = UploadedFile::fake()->create('transfer.pdf', 120, 'application/pdf');
        $requestId = $this->asOwner()->post('/api/v1/tenant/capacity-requests', ['seats' => 50, 'amount' => 500, 'proof' => $proof, 'note' => 'تحويل بنكي'], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('data.request.status', 'pending')->json('data.request.id');

        // One pending request at a time.
        $this->asOwner()->post('/api/v1/tenant/capacity-requests', ['seats' => 5, 'amount' => 50, 'proof' => UploadedFile::fake()->create('t.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertStatus(409)->assertJsonPath('error.code', 'REQUEST_PENDING');

        // The academy cannot raise its own quota through its settings.
        $this->asOwner()->putJson('/api/v1/tenant/settings', ['seat_quota' => 9999]);
        $this->assertSame(1, $this->tenant->fresh()->seat_quota);

        $this->asPlatform()->getJson('/api/v1/platform/capacity/requests?status=pending')->assertOk()
            ->assertJsonPath('data.requests.0.id', $requestId)->assertJsonPath('data.requests.0.seats_used_at_request', 1);
        $this->asPlatform()->get("/api/v1/platform/capacity/requests/{$requestId}/proof")->assertOk();

        $this->asPlatform()->postJson("/api/v1/platform/capacity/requests/{$requestId}/approve", ['seats_granted' => 40])->assertOk()
            ->assertJsonPath('data.request.status', 'approved')->assertJsonPath('data.request.quota_after', 41);
        // Idempotent.
        $this->asPlatform()->postJson("/api/v1/platform/capacity/requests/{$requestId}/approve")->assertOk()->assertJsonPath('data.request.quota_after', 41);
        $this->assertSame(41, $this->tenant->fresh()->seat_quota);

        app(TenantContext::class)->setTenant($this->tenant->fresh());
        $this->createStudent('b')->assertCreated();
    }

    public function test_reject_needs_a_reason_and_tenants_cannot_use_platform_routes(): void
    {
        $this->setQuota(0);
        $id = CapacityRequest::create(['tenant_id' => $this->tenant->id, 'seats_requested' => 10, 'amount' => 100, 'status' => 'pending'])->id;

        $this->asPlatform()->postJson("/api/v1/platform/capacity/requests/{$id}/reject", [])->assertStatus(422);
        $this->asPlatform()->postJson("/api/v1/platform/capacity/requests/{$id}/reject", ['reason' => 'الإثبات غير واضح'])->assertOk()->assertJsonPath('data.request.status', 'rejected');
        $this->assertSame(0, $this->tenant->fresh()->seat_quota);

        $this->asOwner()->postJson("/api/v1/platform/capacity/requests/{$id}/approve")->assertUnauthorized();
        $this->asOwner()->putJson("/api/v1/platform/capacity/tenants/{$this->tenant->id}", ['seat_quota' => 500, 'reason' => 'x'])->assertUnauthorized();
    }

    public function test_super_admin_sets_default_and_per_academy_quota(): void
    {
        $this->asPlatform()->putJson('/api/v1/platform/capacity/default', ['default_seat_quota' => 30])->assertOk()->assertJsonPath('data.default_seat_quota', 30);
        $this->assertSame(30, TenantCapacityService::defaultQuota());

        $this->asPlatform()->putJson("/api/v1/platform/capacity/tenants/{$this->tenant->id}", ['seat_quota' => 75, 'reason' => 'اتفاق خاص'])->assertOk();
        $this->assertSame(75, $this->tenant->fresh()->seat_quota);

        $this->asPlatform()->getJson('/api/v1/platform/capacity/tenants')->assertOk()->assertJsonPath('data.default_seat_quota', 30);
    }
}
