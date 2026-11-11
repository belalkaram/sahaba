<?php

namespace App\Domain\Identity\Services;

use App\Models\Student;
use App\Models\StudentRegistrationRequest;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Support\Audit\AuditLogger;
use App\Support\Saudi\SaudiRules;
use App\Tenancy\TenantRunner;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Student self-registration. The applicant picks one or more centers / independent teachers; each one gets its own
 * request inside its own tenant database and decides independently. Approval creates the student through the same
 * path staff use (UserManagementService::createStudent), which also links the guardian by mobile number (OD-33).
 */
class StudentRegistrationService
{
    public const MAX_TENANTS = 5;

    public function __construct(
        protected TenantRunner $runner,
        protected UserManagementService $users
    ) {}

    /** Tenants that currently accept registrations (the public directory). */
    public function directory(?string $search = null)
    {
        $query = Tenant::query()->where('status', 'active')->where('accepts_registrations', true);
        if ($search !== null && trim($search) !== '') {
            $term = '%'.trim($search).'%';
            $query->where(fn ($q) => $q->where('name', 'like', $term)->orWhere('city', 'like', $term));
        }

        return $query->orderBy('name')->limit(100)->get();
    }

    /**
     * @param  array<string, mixed>  $data  validated and normalised (see PublicRegistrationController)
     * @param  list<string>  $tenantSlugs
     * @return list<array{slug: string, name: string|null, status: string, reference_code: string|null}>
     */
    public function submit(array $data, array $tenantSlugs): array
    {
        $results = [];

        foreach (array_slice(array_values(array_unique($tenantSlugs)), 0, self::MAX_TENANTS) as $slug) {
            $tenant = Tenant::query()
                ->where('slug', $slug)->where('status', 'active')->where('accepts_registrations', true)
                ->first();

            if (! $tenant) {
                $results[] = ['slug' => $slug, 'name' => null, 'status' => 'unavailable', 'reference_code' => null];

                continue;
            }

            try {
                $reference = $this->runner->run($tenant, fn () => $this->createRequest($data));
                $results[] = ['slug' => $slug, 'name' => $tenant->name, 'status' => 'submitted', 'reference_code' => $reference];
            } catch (Throwable $e) {
                // No applicant data in the log line.
                Log::warning('registration.submit_failed', ['tenant' => $slug, 'exception' => $e::class]);
                $results[] = ['slug' => $slug, 'name' => $tenant->name, 'status' => 'failed', 'reference_code' => null];
            }
        }

        return $results;
    }

    /** Status for the applicant: needs the reference AND the student mobile used in the application. */
    public function status(Tenant $tenant, string $reference, string $mobile): ?string
    {
        return $this->runner->run($tenant, function () use ($reference, $mobile) {
            return StudentRegistrationRequest::where('reference_code', $reference)
                ->where('student_phone', $mobile)
                ->value('status');
        });
    }

    protected function createRequest(array $data): string
    {
        $reference = 'REG-'.strtoupper(Str::random(8));
        while (StudentRegistrationRequest::where('reference_code', $reference)->exists()) {
            $reference = 'REG-'.strtoupper(Str::random(8));
        }

        StudentRegistrationRequest::create([
            'reference_code' => $reference,
            'full_name' => $data['full_name'],
            'national_id' => $data['national_id'],
            'national_id_hash' => SaudiRules::hashNationalId($data['national_id']),
            'region' => $data['region'],
            'governorate' => $data['governorate'],
            'address' => $data['address'],
            'education_stage' => $data['education_stage'],
            'grade' => $data['grade'],
            'student_phone' => $data['student_phone'],
            'guardian_name' => $data['guardian_name'],
            'guardian_phone' => $data['guardian_phone'],
            'guardian_occupation' => $data['guardian_occupation'] ?? null,
            'email' => $data['email'] ?? null,
            'password_hash' => Hash::make($data['password']),
            'status' => 'pending',
        ]);

        return $reference;
    }

    /** Approve: creates the student account (login with the mobile number + the password chosen at registration). */
    public function approve(StudentRegistrationRequest $request, TenantUser $actor, ?string $note): Student
    {
        return DB::connection('tenant')->transaction(function () use ($request, $actor, $note) {
            /** @var StudentRegistrationRequest $locked */
            $locked = StudentRegistrationRequest::lockForUpdate()->findOrFail($request->id);
            if (! $locked->isPending()) {
                throw new \DomainException('REQUEST_NOT_PENDING');
            }

            // The user model hashes passwords with the `hashed` cast, which leaves an existing hash untouched.
            $student = $this->users->createStudent([
                'name' => $locked->full_name,
                'email' => $locked->email,
                'phone' => $locked->student_phone,
                'password' => $locked->password_hash,
                'grade_level' => SaudiRules::gradeLabel($locked->education_stage, $locked->grade),
                'parent_name' => $locked->guardian_name,
                'parent_phone' => $locked->guardian_phone,
                'relation_type' => 'guardian',
            ], $actor);

            $student->update([
                'national_id' => $locked->national_id,
                'national_id_hash' => $locked->national_id_hash,
                'region' => $locked->region,
                'governorate' => $locked->governorate,
                'address' => $locked->address,
                'education_stage' => $locked->education_stage,
                'guardian_occupation' => $locked->guardian_occupation,
            ]);

            $locked->update([
                'status' => 'approved',
                'decided_by_user_id' => $actor->id,
                'decided_at' => now(),
                'decision_note' => $note,
                'student_id' => $student->id,
            ]);

            AuditLogger::log('student.registration.approved', null, 'StudentRegistrationRequest', $locked->id, ['student_id' => $student->id]);

            return $student;
        });
    }

    public function reject(StudentRegistrationRequest $request, TenantUser $actor, ?string $note): StudentRegistrationRequest
    {
        return DB::connection('tenant')->transaction(function () use ($request, $actor, $note) {
            $locked = StudentRegistrationRequest::lockForUpdate()->findOrFail($request->id);
            if (! $locked->isPending()) {
                throw new \DomainException('REQUEST_NOT_PENDING');
            }

            $locked->update([
                'status' => 'rejected',
                'decided_by_user_id' => $actor->id,
                'decided_at' => now(),
                'decision_note' => $note,
                // The password hash is not needed any more.
                'password_hash' => '',
            ]);

            AuditLogger::log('student.registration.rejected', null, 'StudentRegistrationRequest', $locked->id);

            return $locked;
        });
    }
}
