<?php

namespace App\Domain\Platform\Capacity;

use App\Models\AccessCredential;
use App\Models\PlatformSetting;
use App\Models\Student;
use App\Models\Tenant;
use App\Support\Audit\AuditLogger;
use App\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

/**
 * ADR-006 / OD-38: seats of the current academy (tenant context required).
 *
 * A student is a code and a code works on one device, so
 *   seats used = Σ over students of max(1, live codes)
 * where a live code is pending/active, not revoked and not expired.
 * Creating a student needs a free seat; a student's first code uses the seat they already hold; any further code
 * (second device) needs another seat. Only the platform super admin raises the quota.
 */
class TenantCapacityService
{
    public const DEFAULT_QUOTA_SETTING = 'default_seat_quota';

    public function __construct(private readonly TenantContext $context) {}

    public function used(): int
    {
        $students = Student::count();
        $live = $this->liveCodes();
        $codes = (clone $live)->count();
        $studentsWithCodes = (clone $live)->distinct()->count('student_id');

        return $students + $codes - $studentsWithCodes;
    }

    /** Quota of the current academy; initialised to its current usage the first time (never locks anyone out). */
    public function quota(): int
    {
        $tenant = $this->tenant();
        if ($tenant->seat_quota === null) {
            $used = $this->used();
            $tenant->forceFill(['seat_quota' => $used])->save();
            AuditLogger::log(action: 'tenant.seat_quota.initialised', tenantId: $tenant->id, entityType: 'Tenant', entityId: $tenant->id, payload: ['seat_quota' => $used], actorType: 'system');
        }

        return (int) $tenant->seat_quota;
    }

    /** @return array{quota: int, used: int, available: int} */
    public function summary(): array
    {
        $quota = $this->quota();
        $used = $this->used();

        return ['quota' => $quota, 'used' => $used, 'available' => max(0, $quota - $used)];
    }

    /** @throws CapacityExceededException */
    public function assertCanAdd(int $seats = 1): void
    {
        if (! config('platform.capacity_enforced', true)) {
            return;
        }
        $quota = $this->quota();
        $used = $this->used();
        if ($used + $seats > $quota) {
            throw new CapacityExceededException($used, $quota, $seats);
        }
    }

    /** A new code for this student needs a seat only if the student already has a live code (second device). */
    public function assertCanIssueCode(Student $student): void
    {
        if (! config('platform.capacity_enforced', true)) {
            return;
        }
        if ((clone $this->liveCodes())->where('student_id', $student->id)->exists()) {
            $this->assertCanAdd(1);
        }
    }

    public static function defaultQuota(): int
    {
        return max(0, (int) PlatformSetting::getValue(self::DEFAULT_QUOTA_SETTING, 0));
    }

    private function liveCodes()
    {
        return AccessCredential::query()
            ->whereIn('status', ['pending', 'active'])
            ->whereNull('revoked_at')
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
    }

    private function tenant(): Tenant
    {
        $tenant = $this->context->getTenant();
        if (! $tenant) {
            throw new \LogicException('Tenant context is required for capacity checks.');
        }

        return $tenant;
    }
}
