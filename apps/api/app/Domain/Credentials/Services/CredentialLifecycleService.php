<?php

namespace App\Domain\Credentials\Services;

use App\Domain\Communication\NotificationCatalog;
use App\Domain\Communication\NotificationService;
use App\Models\AccessCredential;
use App\Models\DeviceBinding;
use App\Models\Student;
use App\Models\TenantUser;
use App\Support\Audit\AuditLogger;

class CredentialLifecycleService
{
    /**
     * Issue/Generate a new access credential for a student.
     * Enforces raw secret hashing (SHA-256); secret never stored in plain text or logged.
     *
     * @return array{credential: AccessCredential, plainTextSecret: string}
     */
    public function issueCredential(Student $student, TenantUser $issuer, ?\DateTimeInterface $expiresAt = null): array
    {
        // ADR-006: a second live code (another device) takes another seat; the first uses the student's own seat.
        app(\App\Domain\Platform\Capacity\TenantCapacityService::class)->assertCanIssueCode($student);

        $result = AccessCredential::generate($student, $issuer, $expiresAt);

        AuditLogger::log(
            action: 'credential.issued',
            entityType: 'AccessCredential',
            entityId: $result['credential']->id,
            payload: [
                'student_id' => $student->id,
                'credential_code' => $result['credential']->credential_code,
            ],
            actorType: 'staff',
            actorId: $issuer->id
        );

        app(NotificationService::class)->sendToStudent(NotificationCatalog::CREDENTIAL_ISSUED, $student, [], '/student/card', includeParents: false);

        return $result;
    }

    /**
     * Unbind device from a credential (R0-6).
     *
     * Staff action that clears the current device binding (with audit).
     * The student's next successful coupon login will bind the new device automatically.
     * This replaces the old "replace with random fingerprint" approach which was
     * locking students out of their accounts (T-SEC-12).
     */
    public function unbindDevice(
        AccessCredential $credential,
        TenantUser $staff,
        string $reason,
    ): AccessCredential {
        $previousDeviceId = $credential->deviceBinding?->device_id;

        // Clear the current device binding (use dynamic property, not method, so it's nullable)
        $credential->deviceBinding?->delete();
        $credential->refresh();

        AuditLogger::log(
            action: 'credential.device_unbound',
            entityType: 'AccessCredential',
            entityId: $credential->id,
            payload: [
                'previous_device_id' => $previousDeviceId,
                'reason' => $reason,
                'note' => 'Student must log in again to bind new device.',
            ],
            actorType: 'staff',
            actorId: $staff->id,
        );

        if ($credential->student) {
            app(NotificationService::class)->sendToStudent(NotificationCatalog::DEVICE_UNBOUND, $credential->student, [], '/student/profile', includeParents: false);
        }

        return $credential->fresh();
    }

    /**
     * Replace device binding with authorized staff approval and immutable audit record.
     *
     * NOTE: Prefer unbindDevice() for most use cases (R0-6).
     * This method is only for cases where you already know the new device ID/fingerprint.
     */
    public function replaceDevice(
        AccessCredential $credential,
        TenantUser $staff,
        string $newDeviceId,
        string $newFingerprint,
        string $reason,
        ?string $name = null
    ): DeviceBinding {
        $previousDeviceId = $credential->deviceBinding?->device_id;

        $newBinding = $credential->replaceDevice(
            $newDeviceId,
            $newFingerprint,
            $reason,
            $staff,
            $name
        );

        AuditLogger::log(
            action: 'credential.device_replaced',
            entityType: 'AccessCredential',
            entityId: $credential->id,
            payload: [
                'old_device_id' => $previousDeviceId,
                'new_device_id' => $newDeviceId,
                'reason' => $reason,
            ],
            actorType: 'staff',
            actorId: $staff->id,
        );

        return $newBinding;
    }

    /**
     * Revoke credential.
     */
    public function revoke(AccessCredential $credential, TenantUser $staff, string $reason): AccessCredential
    {
        $credential->revoke($reason);

        AuditLogger::log(
            action: 'credential.revoked',
            entityType: 'AccessCredential',
            entityId: $credential->id,
            payload: ['reason' => $reason],
            actorType: 'staff',
            actorId: $staff->id
        );

        return $credential->fresh();
    }
}
