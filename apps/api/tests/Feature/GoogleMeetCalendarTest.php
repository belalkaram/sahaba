<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\IntegrationConnection;
use App\Models\Meeting;
use App\Models\Role;
use App\Models\Staff;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * R8-6: real Google Meet conferences through the tenant Google connection (ADR-008), Google faked at the HTTP layer.
 */
class GoogleMeetCalendarTest extends TestCase
{
    use RefreshDatabase;

    private const EVENTS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events*';

    private string $slug;

    private string $teacherToken;

    private string $studentToken;

    protected function setUp(): void
    {
        parent::setUp();

        $this->slug = 'gm-'.strtolower(Str::random(6));
        $tenant = Tenant::create(['name' => 'Meet Academy', 'slug' => $this->slug, 'status' => 'active']);
        TenantDatabase::create(['tenant_id' => $tenant->id, 'connection_identifier' => 'tenant_'.$this->slug, 'status' => 'ready']);
        $db = app(TenantDatabaseManager::class);
        $db->migrateTenant($tenant);
        app(TenantContext::class)->setTenant($tenant);
        $db->configureConnection($tenant);
        app(RoleSynchronizer::class)->sync();

        [$teacher, $this->teacherToken] = $this->user('teacher', 'teacher', 'staff');
        Staff::create(['user_id' => $teacher->id, 'staff_type' => 'teacher', 'status' => 'active']);
        $this->studentToken = $this->user('student', 'student', 'student')[1];
    }

    /** @return array{0: TenantUser, 1: string} */
    private function user(string $tag, string $role, string $type): array
    {
        $user = TenantUser::create(['name' => "U $tag", 'email' => "$tag@gm.test", 'password' => bcrypt('x'), 'type' => $type, 'status' => 'active']);
        $user->roles()->attach(Role::where('name', $role)->firstOrFail()->id);

        return [$user, TenantToken::createTokenFor($user)['plainTextToken']];
    }

    private function as(string $token)
    {
        return $this->flushHeaders()->withHeaders(['X-Tenant-Slug' => $this->slug, 'Authorization' => 'Bearer '.$token]);
    }

    private function fakeGoogle(array $stubs): void
    {
        Http::swap(new HttpFactory);
        Http::fake($stubs);
    }

    private function connect(): void
    {
        IntegrationConnection::create([
            'provider' => 'google', 'status' => 'connected', 'account_email' => 'owner@gmail.test',
            'access_token' => 'ya29.access', 'refresh_token' => '1//refresh', 'token_expires_at' => now()->addHour(),
            'scopes' => ['https://www.googleapis.com/auth/calendar.events'], 'connected_at' => now(),
        ]);
    }

    /** @return array<string, mixed> */
    private function event(): array
    {
        return [
            'id' => 'evt123', 'htmlLink' => 'https://calendar.google.com/event?eid=evt123',
            'hangoutLink' => 'https://meet.google.com/abc-defg-hij',
            'conferenceData' => ['conferenceId' => 'abc-defg-hij'],
        ];
    }

    private function create(array $overrides = [])
    {
        return $this->as($this->teacherToken)->postJson('/api/v1/meetings', $overrides + [
            'title' => 'Live algebra', 'provider' => 'google_meet', 'duration_minutes' => 45,
            'start_time' => now()->addMinutes(5)->toIso8601String(), 'idempotency_key' => 'req-1',
        ]);
    }

    public function test_google_meet_meeting_is_created_as_a_calendar_event_with_a_real_link(): void
    {
        $this->connect();
        $this->fakeGoogle([self::EVENTS => Http::response($this->event())]);

        $res = $this->create()->assertCreated();

        $res->assertJsonPath('data.meeting.provider', 'google_meet')
            ->assertJsonPath('data.meeting.external_meeting_id', 'evt123')
            ->assertJsonPath('data.meeting.join_url', 'https://meet.google.com/abc-defg-hij');

        Http::assertSent(function (HttpRequest $r) {
            return $r->method() === 'POST'
                && str_contains($r->url(), 'conferenceDataVersion=1')
                && str_contains($r->url(), 'sendUpdates=none')
                && $r->hasHeader('Authorization', 'Bearer ya29.access')
                && $r['conferenceData']['createRequest']['conferenceSolutionKey']['type'] === 'hangoutsMeet'
                && $r['conferenceData']['createRequest']['requestId'] === 'req-1'
                && ! isset($r['attendees']);
        });
    }

    public function test_student_gets_the_meet_link_only_from_the_join_endpoint(): void
    {
        $this->connect();
        $this->fakeGoogle([self::EVENTS => Http::response($this->event())]);
        $id = $this->create()->json('data.meeting.id');

        $list = $this->as($this->studentToken)->getJson('/api/v1/meetings')->assertOk();
        $this->assertArrayNotHasKey('join_url', $list->json('data.meetings.0'));

        $this->as($this->studentToken)->getJson("/api/v1/meetings/$id/join")
            ->assertOk()->assertJsonPath('data.join_url', 'https://meet.google.com/abc-defg-hij');
    }

    public function test_pending_conference_is_read_again_before_giving_up(): void
    {
        $this->connect();
        $pending = ['id' => 'evt123', 'conferenceData' => ['createRequest' => ['status' => ['statusCode' => 'pending']]]];
        Http::swap(new HttpFactory);
        Http::fake([self::EVENTS => Http::sequence()->push($pending)->push($this->event())]);

        $this->create()->assertCreated()->assertJsonPath('data.meeting.join_url', 'https://meet.google.com/abc-defg-hij');
    }

    public function test_no_conference_means_no_meeting_is_saved(): void
    {
        $this->connect();
        $this->fakeGoogle([self::EVENTS => Http::response(['id' => 'evt123'])]);

        $this->create()->assertStatus(502)->assertJsonPath('error.code', 'PROVIDER_ERROR');
        $this->assertSame(0, Meeting::count());
    }

    public function test_without_a_connection_google_meet_is_refused(): void
    {
        $this->fakeGoogle([]);

        $this->create()->assertStatus(422)->assertJsonPath('error.code', 'GOOGLE_NOT_CONNECTED');
        Http::assertNothingSent();
    }

    public function test_revoked_token_marks_the_connection_broken(): void
    {
        $this->connect();
        IntegrationConnection::google()->forceFill(['token_expires_at' => now()->subMinute()])->save();
        $this->fakeGoogle(['https://oauth2.googleapis.com/token' => Http::response(['error' => 'invalid_grant'], 400)]);

        $this->create()->assertStatus(422)->assertJsonPath('error.code', 'GOOGLE_NOT_CONNECTED');
        $this->assertSame('error', IntegrationConnection::google()->status);
    }

    public function test_cancel_deletes_the_calendar_event(): void
    {
        $this->connect();
        $this->fakeGoogle([self::EVENTS => Http::response($this->event())]);
        $id = $this->create()->json('data.meeting.id');

        $this->fakeGoogle([self::EVENTS => Http::response('', 204)]);
        $this->as($this->teacherToken)->postJson("/api/v1/meetings/$id/cancel")
            ->assertOk()->assertJsonPath('data.provider_cancelled', true);

        Http::assertSent(fn (HttpRequest $r) => $r->method() === 'DELETE' && str_contains($r->url(), '/events/evt123'));
        $this->assertSame('cancelled', Meeting::find($id)->status);
    }

    public function test_cancel_still_closes_the_meeting_when_google_fails(): void
    {
        $this->connect();
        $this->fakeGoogle([self::EVENTS => Http::response($this->event())]);
        $id = $this->create()->json('data.meeting.id');

        $this->fakeGoogle([self::EVENTS => Http::response(['error' => ['status' => 'INTERNAL']], 500)]);
        $this->as($this->teacherToken)->postJson("/api/v1/meetings/$id/cancel")
            ->assertOk()->assertJsonPath('data.provider_cancelled', false);
        $this->assertSame('cancelled', Meeting::find($id)->status);
    }
}
