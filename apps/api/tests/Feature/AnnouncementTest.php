<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\ParentProfile;
use App\Models\Role;
use App\Models\Staff;
use App\Models\Student;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** OD-37 (ANN-1): exact audience, bell / banner / modal, once / persistent, receipts, scope. */
class AnnouncementTest extends TestCase
{
    use RefreshDatabase;

    private string $slug;

    private string $ownerToken;

    private string $teacherToken;

    private Course $algebra;

    private Course $physics;

    /** @var array<string, array{student: Student, token: string}> */
    private array $s = [];

    private string $parentToken;

    protected function setUp(): void
    {
        parent::setUp();

        $this->slug = 'ann-'.strtolower(Str::random(6));
        $tenant = Tenant::create(['name' => 'Ann School', 'slug' => $this->slug, 'status' => 'active']);
        TenantDatabase::create(['tenant_id' => $tenant->id, 'connection_identifier' => 'tenant_'.$this->slug, 'status' => 'ready']);
        $db = app(TenantDatabaseManager::class);
        $db->migrateTenant($tenant);
        app(TenantContext::class)->setTenant($tenant);
        $db->configureConnection($tenant);
        app(RoleSynchronizer::class)->sync();

        $this->ownerToken = $this->user('owner', 'owner', 'staff')[1];
        [$teacher, $this->teacherToken] = $this->user('teacher', 'teacher', 'staff');
        $teacherStaff = Staff::create(['user_id' => $teacher->id, 'staff_type' => 'teacher', 'status' => 'active']);
        $otherStaff = Staff::create(['user_id' => $this->user('other', 'teacher', 'staff')[0]->id, 'staff_type' => 'teacher', 'status' => 'active']);

        $this->algebra = Course::create(['teacher_staff_id' => $teacherStaff->id, 'title' => 'Algebra', 'code' => 'ALG', 'status' => 'published', 'is_free' => true]);
        $this->physics = Course::create(['teacher_staff_id' => $otherStaff->id, 'title' => 'Physics', 'code' => 'PHY', 'status' => 'published', 'is_free' => true]);

        foreach (['a1' => $this->algebra, 'a2' => $this->algebra, 'p1' => $this->physics] as $tag => $course) {
            [$user, $token] = $this->user($tag, 'student', 'student');
            $student = Student::create(['user_id' => $user->id, 'student_code' => strtoupper($tag), 'grade_level' => $tag === 'p1' ? 'G2' : 'G1', 'status' => 'active']);
            Enrollment::create(['student_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);
            $this->s[$tag] = ['student' => $student, 'token' => $token];
        }

        [$parentUser, $this->parentToken] = $this->user('parent', 'parent', 'parent');
        $parent = ParentProfile::create(['user_id' => $parentUser->id, 'status' => 'active']);
        $this->s['a1']['student']->parents()->attach($parent->id, ['relation_type' => 'father']);
    }

    /** @return array{0: TenantUser, 1: string} */
    private function user(string $tag, string $role, string $type): array
    {
        $user = TenantUser::create(['name' => "U $tag", 'email' => "$tag@ann.test", 'password' => bcrypt('x'), 'type' => $type, 'status' => 'active']);
        $user->roles()->attach(Role::where('name', $role)->firstOrFail()->id);

        return [$user, TenantToken::createTokenFor($user)['plainTextToken']];
    }

    private function as(string $token)
    {
        return $this->withHeaders(['X-Tenant-Slug' => $this->slug, 'Authorization' => 'Bearer '.$token]);
    }

    private function publish(string $token, array $overrides = [])
    {
        return $this->as($token)->postJson('/api/v1/announcements', array_replace_recursive([
            'title' => 'Exam moved',
            'body' => 'The exam moved to Sunday.',
            'display' => 'modal',
            'frequency' => 'once',
            'audience' => ['target' => 'courses', 'ids' => [$this->algebra->id], 'students' => true, 'parents' => false],
        ], $overrides));
    }

    public function test_preview_resolves_the_exact_audience_with_parents(): void
    {
        $this->as($this->ownerToken)->postJson('/api/v1/announcements/preview', [
            'audience' => ['target' => 'courses', 'ids' => [$this->algebra->id], 'students' => true, 'parents' => true],
        ])->assertOk()
            ->assertJsonPath('data.students', 2)
            ->assertJsonPath('data.parents', 1)
            ->assertJsonPath('data.recipients', 3);

        $this->as($this->ownerToken)->postJson('/api/v1/announcements/preview', [
            'audience' => ['target' => 'grades', 'ids' => ['G2'], 'students' => true],
        ])->assertOk()->assertJsonPath('data.recipients', 1);

        $this->as($this->ownerToken)->postJson('/api/v1/announcements/preview', [
            'audience' => ['target' => 'students', 'ids' => [$this->s['a1']['student']->id], 'students' => false, 'parents' => true],
        ])->assertOk()->assertJsonPath('data.students', 0)->assertJsonPath('data.parents', 1);
    }

    public function test_once_modal_disappears_after_the_person_closes_it_and_receipts_are_recorded(): void
    {
        $id = $this->publish($this->ownerToken)->assertCreated()->assertJsonPath('data.announcement.recipients_count', 2)->json('data.announcement.id');

        $this->as($this->s['a1']['token'])->getJson('/api/v1/me/announcements')
            ->assertOk()->assertJsonCount(1, 'data.announcements')->assertJsonPath('data.announcements.0.display', 'modal');
        // Not in the audience.
        $this->as($this->s['p1']['token'])->getJson('/api/v1/me/announcements')->assertOk()->assertJsonCount(0, 'data.announcements');

        $this->as($this->s['a1']['token'])->postJson("/api/v1/me/announcements/{$id}/seen")->assertOk();
        $this->as($this->s['a1']['token'])->postJson("/api/v1/me/announcements/{$id}/dismiss")->assertOk();
        $this->as($this->s['a1']['token'])->getJson('/api/v1/me/announcements')->assertOk()->assertJsonCount(0, 'data.announcements');
        // Someone outside the audience cannot write a receipt.
        $this->as($this->s['p1']['token'])->postJson("/api/v1/me/announcements/{$id}/dismiss")->assertNotFound();

        $this->as($this->ownerToken)->getJson('/api/v1/announcements')
            ->assertOk()->assertJsonPath('data.announcements.0.seen_count', 1)->assertJsonPath('data.announcements.0.dismissed_count', 1);
        $this->as($this->ownerToken)->getJson("/api/v1/announcements/{$id}/recipients?state=unseen")
            ->assertOk()->assertJsonCount(1, 'data.recipients');
    }

    public function test_persistent_banner_keeps_showing_until_withdrawn(): void
    {
        $id = $this->publish($this->ownerToken, ['display' => 'banner', 'frequency' => 'persistent'])->assertCreated()->json('data.announcement.id');

        $this->as($this->s['a2']['token'])->postJson("/api/v1/me/announcements/{$id}/dismiss")->assertOk();
        $this->as($this->s['a2']['token'])->getJson('/api/v1/me/announcements')->assertOk()->assertJsonCount(1, 'data.announcements');

        $this->as($this->ownerToken)->postJson("/api/v1/announcements/{$id}/withdraw")->assertOk()->assertJsonPath('data.announcement.state', 'withdrawn');
        $this->as($this->s['a2']['token'])->getJson('/api/v1/me/announcements')->assertOk()->assertJsonCount(0, 'data.announcements');
    }

    public function test_scheduled_announcement_is_hidden_until_it_starts(): void
    {
        $this->publish($this->ownerToken, ['display' => 'banner', 'starts_at' => now()->addDay()->toIso8601String()])->assertCreated()->assertJsonPath('data.announcement.state', 'scheduled');
        $this->as($this->s['a1']['token'])->getJson('/api/v1/me/announcements')->assertOk()->assertJsonCount(0, 'data.announcements');
    }

    public function test_bell_announcement_becomes_a_notification_and_reading_it_counts_as_seen(): void
    {
        $id = $this->publish($this->ownerToken, ['display' => 'bell', 'frequency' => null, 'audience' => ['parents' => true]])->assertCreated()->json('data.announcement.id');

        $notifications = $this->as($this->parentToken)->getJson('/api/v1/notifications')->assertOk()->json('data.notifications');
        $this->assertNotEmpty($notifications);
        $this->as($this->parentToken)->postJson('/api/v1/notifications/'.$notifications[0]['id'].'/read')->assertOk();

        $this->as($this->ownerToken)->getJson("/api/v1/announcements/{$id}/recipients?state=seen")
            ->assertOk()->assertJsonCount(1, 'data.recipients')->assertJsonPath('data.recipients.0.role', 'parent');
        // Bell announcements are not pop-ups or bars.
        $this->as($this->parentToken)->getJson('/api/v1/me/announcements')->assertOk()->assertJsonCount(0, 'data.announcements');
    }

    public function test_teacher_scope_is_limited_to_own_courses(): void
    {
        $this->publish($this->teacherToken)->assertCreated()->assertJsonPath('data.announcement.recipients_count', 2);
        $this->publish($this->teacherToken, ['audience' => ['target' => 'courses', 'ids' => [$this->physics->id]]])->assertForbidden();
        $this->publish($this->teacherToken, ['audience' => ['target' => 'all', 'ids' => []]])->assertForbidden();
        // A chosen student outside the teacher's courses is silently out of reach: nobody left = 422.
        $this->publish($this->teacherToken, ['audience' => ['target' => 'students', 'ids' => [$this->s['p1']['student']->id]]])->assertStatus(422);

        $this->as($this->teacherToken)->getJson('/api/v1/announcements/options')->assertOk()->assertJsonPath('data.scope', 'own')->assertJsonCount(1, 'data.courses');
    }

    public function test_students_cannot_send_announcements(): void
    {
        $this->publish($this->s['a1']['token'])->assertForbidden();
        $this->as($this->s['a1']['token'])->getJson('/api/v1/announcements')->assertForbidden();
    }
}
