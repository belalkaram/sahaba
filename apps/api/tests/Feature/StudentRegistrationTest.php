<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Student;
use App\Models\StudentRegistrationRequest;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Support\Saudi\SaudiRules;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Student self-registration: Saudi input rules, opt-in directory, per-tenant requests, review, approval, login.
 */
class StudentRegistrationTest extends TestCase
{
    use RefreshDatabase;

    private const NATIONAL_ID = '1000000008';

    private function tenant(string $name, bool $accepts, string $type = 'organization'): array
    {
        $slug = 'reg-'.Str::lower(Str::random(6));
        $tenant = Tenant::create(['name' => $name, 'slug' => $slug, 'status' => 'active', 'type' => $type, 'accepts_registrations' => $accepts]);
        TenantDatabase::create(['tenant_id' => $tenant->id, 'connection_identifier' => 'tenant_'.$slug, 'status' => 'ready']);

        $db = app(TenantDatabaseManager::class);
        $db->migrateTenant($tenant);
        $db->configureConnection($tenant);
        app(TenantContext::class)->setTenant($tenant);
        app(RoleSynchronizer::class)->sync();

        $make = function (string $email, string $roleName) {
            $user = TenantUser::create(['name' => $email, 'email' => $email, 'password' => Hash::make('secret123'), 'type' => $roleName === 'student' ? 'student' : 'staff', 'status' => 'active']);
            $user->roles()->attach(Role::where('name', $roleName)->firstOrFail()->id);

            return TenantToken::createTokenFor($user)['plainTextToken'];
        };

        return [
            'tenant' => $tenant,
            'slug' => $slug,
            'adminToken' => $make("admin@{$slug}.test", 'center_admin'),
            'teacherToken' => $make("teacher@{$slug}.test", 'teacher'),
            'studentToken' => $make("student@{$slug}.test", 'student'),
        ];
    }

    private function payload(array $slugs, array $override = []): array
    {
        return array_merge([
            'full_name' => 'عبدالله محمد العتيبي',
            'national_id' => self::NATIONAL_ID,
            'region' => 'riyadh',
            'governorate' => 'الدرعية',
            'address' => 'حي النخيل، شارع الأمير سلطان',
            'education_stage' => 'secondary',
            'grade' => 2,
            'student_phone' => '0512345678',
            'guardian_name' => 'محمد سعد العتيبي',
            'guardian_phone' => '0555555555',
            'guardian_occupation' => 'موظف حكومي',
            'email' => '',
            'password' => 'Secret123',
            'password_confirmation' => 'Secret123',
            'tenants' => $slugs,
        ], $override);
    }

    private function as(array $env, string $key)
    {
        return $this->withHeaders(['X-Tenant-Slug' => $env['slug'], 'Authorization' => 'Bearer '.$env[$key]]);
    }

    /** Guards against tests creating schemas/tables on a real Postgres configured in .env (no DB access here). */
    public function test_the_test_suite_never_uses_a_remote_tenant_store(): void
    {
        $this->assertSame('sqlite', config('database.connections.tenant.driver'));
        $this->assertEmpty(config('database.connections.tenant.url'));
        $this->assertSame('sqlite', config('database.default'));
    }

    public function test_saudi_rules(): void
    {
        $this->assertTrue(SaudiRules::isValidNationalId('1000000008'));
        $this->assertTrue(SaudiRules::isValidNationalId('2000000006'));
        $this->assertTrue(SaudiRules::isValidNationalId('١٠٠٠٠٠٠٠٠٨'.''), 'Arabic-Indic digits are normalised');
        $this->assertFalse(SaudiRules::isValidNationalId('1000000009'), 'bad checksum');
        $this->assertFalse(SaudiRules::isValidNationalId('3000000004'), 'must start with 1 or 2');
        $this->assertFalse(SaudiRules::isValidNationalId('100000008'), '10 digits');

        foreach (['0512345678', '512345678', '+966512345678', '966512345678', '00966512345678', '٠٥١٢٣٤٥٦٧٨', '051 234 5678'] as $form) {
            $this->assertSame('0512345678', SaudiRules::normalizeMobile($form), $form);
        }
        $this->assertNull(SaudiRules::normalizeMobile('0412345678'));
        $this->assertNull(SaudiRules::normalizeMobile('05123'));

        $this->assertSame('الصف الثاني الثانوي', SaudiRules::gradeLabel('secondary', 2));
        $this->assertTrue(SaudiRules::isValidGrade('primary', 6));
        $this->assertFalse(SaudiRules::isValidGrade('secondary', 4));
        $this->assertSame('••••••0008', SaudiRules::maskNationalId('1000000008'));
    }

    public function test_directory_lists_only_active_opted_in_tenants(): void
    {
        $open = $this->tenant('مركز النور', true);
        $this->tenant('مركز مغلق', false);

        $names = collect($this->getJson('/api/v1/public/registration/academies')->assertOk()->json('data.academies'))->pluck('slug');

        $this->assertContains($open['slug'], $names->all());
        $this->assertCount(1, $names);
        $this->getJson('/api/v1/public/registration/options')->assertOk()->assertJsonCount(13, 'data.regions')->assertJsonCount(3, 'data.stages');
    }

    public function test_submit_creates_one_request_per_chosen_tenant_and_protects_the_national_id(): void
    {
        $a = $this->tenant('مركز النور', true);
        $b = $this->tenant('أستاذ خالد', true, 'individual_teacher');
        $closed = $this->tenant('مركز مغلق', false);

        $resp = $this->postJson('/api/v1/public/registration', $this->payload([$a['slug'], $b['slug'], $closed['slug'], 'no-such-tenant']))->assertCreated();
        $statuses = collect($resp->json('data.results'))->pluck('status', 'slug');

        $this->assertSame('submitted', $statuses[$a['slug']]);
        $this->assertSame('submitted', $statuses[$b['slug']]);
        $this->assertSame('unavailable', $statuses[$closed['slug']]);
        $this->assertSame('unavailable', $statuses['no-such-tenant']);

        $this->as($a, 'adminToken')->getJson('/api/v1/registration-requests')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.full_name', 'عبدالله محمد العتيبي')
            ->assertJsonPath('data.0.national_id_masked', '••••••0008')
            ->assertJsonPath('data.0.grade_label', 'الصف الثاني الثانوي')
            ->assertJsonPath('data.0.student_phone', '0512345678');

        // Closed tenant never received anything; tenant B's request is isolated from A's inbox.
        $this->as($closed, 'adminToken')->getJson('/api/v1/registration-requests')->assertOk()->assertJsonCount(0, 'data');

        // The ID is encrypted at rest and the password is hashed.
        app(TenantDatabaseManager::class)->configureConnection($a['tenant']);
        $raw = DB::connection('tenant')->table('student_registration_requests')->first();
        $this->assertStringNotContainsString(self::NATIONAL_ID, json_encode($raw));
        $this->assertTrue(Hash::check('Secret123', $raw->password_hash));
    }

    public function test_validation_rejects_bad_saudi_input(): void
    {
        $t = $this->tenant('مركز', true);
        $slugs = [$t['slug']];

        $cases = [
            ['national_id' => '1000000009'],
            ['student_phone' => '0412345678'],
            ['guardian_phone' => '0512345678'], // same as the student's
            ['region' => 'atlantis'],
            ['education_stage' => 'secondary', 'grade' => 4],
            ['password' => 'onlyletters', 'password_confirmation' => 'onlyletters'],
            ['password_confirmation' => 'Different123'],
            ['tenants' => []],
            ['full_name' => 'عبد'],
        ];
        foreach ($cases as $override) {
            $this->postJson('/api/v1/public/registration', $this->payload($slugs, $override))->assertStatus(422);
        }

        // Arabic-Indic digits and +966 are accepted and stored normalised.
        $this->postJson('/api/v1/public/registration', $this->payload($slugs, ['national_id' => '١٠٠٠٠٠٠٠٠٨', 'student_phone' => '+966512345678']))->assertCreated();
        $this->as($t, 'adminToken')->getJson('/api/v1/registration-requests')->assertJsonPath('data.0.student_phone', '0512345678');
    }

    public function test_honeypot_creates_nothing(): void
    {
        $t = $this->tenant('مركز', true);
        $this->postJson('/api/v1/public/registration', $this->payload([$t['slug']], ['website' => 'http://spam']))->assertCreated();
        $this->as($t, 'adminToken')->getJson('/api/v1/registration-requests')->assertJsonCount(0, 'data');
    }

    public function test_only_tenant_scope_reviewers_can_see_and_decide(): void
    {
        $t = $this->tenant('مركز', true);
        $this->postJson('/api/v1/public/registration', $this->payload([$t['slug']]))->assertCreated();

        $this->as($t, 'studentToken')->getJson('/api/v1/registration-requests')->assertForbidden();
        // withHeaders() is cumulative on the test case: drop the student's token before the anonymous call.
        $this->flushHeaders();
        $this->getJson('/api/v1/registration-requests', ['X-Tenant-Slug' => $t['slug']])->assertUnauthorized();
    }

    public function test_approval_creates_a_student_who_can_log_in_with_the_mobile_and_links_the_guardian(): void
    {
        $t = $this->tenant('مركز', true);
        $this->postJson('/api/v1/public/registration', $this->payload([$t['slug']], ['email' => 'abdullah@example.com']))->assertCreated();
        $id = $this->as($t, 'adminToken')->getJson('/api/v1/registration-requests')->json('data.0.id');

        $this->as($t, 'adminToken')->postJson("/api/v1/registration-requests/{$id}/approve", ['note' => 'مرحبًا'])
            ->assertOk()->assertJsonPath('data.request.status', 'approved');

        // Any spelling of the mobile logs in with the password chosen at registration.
        foreach (['0512345678', '+966512345678', '٠٥١٢٣٤٥٦٧٨'] as $identifier) {
            $this->withHeaders(['X-Tenant-Slug' => $t['slug']])
                ->postJson('/api/v1/auth/login', ['identifier' => $identifier, 'password' => 'Secret123'])
                ->assertOk();
        }
        $this->withHeaders(['X-Tenant-Slug' => $t['slug']])
            ->postJson('/api/v1/auth/login', ['identifier' => '0512345678', 'password' => 'wrong-pass1'])->assertUnauthorized();

        app(TenantDatabaseManager::class)->configureConnection($t['tenant']);
        $student = Student::where('grade_level', 'الصف الثاني الثانوي')->firstOrFail();
        $this->assertSame(self::NATIONAL_ID, $student->national_id);
        $this->assertArrayNotHasKey('national_id', $student->toArray());
        $this->assertSame('riyadh', $student->region);
        $this->assertSame('محمد سعد العتيبي', $student->parents()->firstOrFail()->user->name);
        $this->assertSame('0555555555', $student->parents()->firstOrFail()->user->phone);

        // Deciding twice is refused.
        $this->as($t, 'adminToken')->postJson("/api/v1/registration-requests/{$id}/approve")->assertStatus(409);
        $this->as($t, 'adminToken')->postJson("/api/v1/registration-requests/{$id}/reject")->assertStatus(409);
    }

    public function test_rejection_is_final_and_clears_the_password_hash(): void
    {
        $t = $this->tenant('مركز', true);
        $this->postJson('/api/v1/public/registration', $this->payload([$t['slug']]))->assertCreated();
        $id = $this->as($t, 'adminToken')->getJson('/api/v1/registration-requests')->json('data.0.id');

        $this->as($t, 'adminToken')->postJson("/api/v1/registration-requests/{$id}/reject", ['note' => 'غير مستوفٍ'])
            ->assertOk()->assertJsonPath('data.request.status', 'rejected');

        $this->assertSame('', StudentRegistrationRequest::findOrFail($id)->password_hash);
        $this->as($t, 'adminToken')->getJson('/api/v1/registration-requests/pending-count')->assertJsonPath('data.pending', 0);
        $this->withHeaders(['X-Tenant-Slug' => $t['slug']])
            ->postJson('/api/v1/auth/login', ['identifier' => '0512345678', 'password' => 'Secret123'])->assertUnauthorized();
    }

    public function test_applicant_status_needs_the_reference_and_the_matching_mobile(): void
    {
        $t = $this->tenant('مركز', true);
        $ref = $this->postJson('/api/v1/public/registration', $this->payload([$t['slug']]))->json('data.results.0.reference_code');

        $q = ['tenant' => $t['slug'], 'reference' => $ref];
        $this->getJson('/api/v1/public/registration/status?'.http_build_query($q + ['phone' => '+966512345678']))
            ->assertOk()->assertJsonPath('data.status', 'pending');
        $this->getJson('/api/v1/public/registration/status?'.http_build_query($q + ['phone' => '0599999999']))->assertNotFound();
        $this->getJson('/api/v1/public/registration/status?'.http_build_query(['tenant' => $t['slug'], 'reference' => 'REG-NOPE', 'phone' => '0512345678']))->assertNotFound();
    }
}
