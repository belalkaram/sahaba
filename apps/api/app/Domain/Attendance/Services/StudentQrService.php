<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Exceptions\AttendanceScanException;
use App\Models\DeviceCredential;
use App\Models\Student;
use App\Models\Tenant;
use Illuminate\Support\Carbon;

class StudentQrService
{
    public const TOKEN_TTL_SECONDS = 60;

    /**
     * Generate a signed, opaque, short-lived attendance QR token for a student.
     * Token payload NEVER contains the student code or secret credentials.
     *
     * @return array{token: string, expires_at: string, expires_in_seconds: int}
     */
    public function generateToken(Student $student, Tenant $tenant, ?string $credentialId = null): array
    {
        if ($student->status !== 'active') {
            throw new AttendanceScanException('STUDENT_INACTIVE', 'حساب الطالب غير نشط ولا يمكن توليد رمز حضور له.');
        }

        $now = now()->timestamp;
        $exp = $now + self::TOKEN_TTL_SECONDS;

        $payload = [
            'sub' => $student->id,
            'tenant' => $tenant->id,
            'user_id' => $student->user_id,
            'iat' => $now,
            'exp' => $exp,
            'nonce' => bin2hex(random_bytes(8)),
            'cid' => $credentialId,
        ];

        $b64Payload = $this->base64UrlEncode(json_encode($payload, JSON_THROW_ON_ERROR));
        $signature = $this->sign($b64Payload, $tenant);
        $token = $b64Payload.'.'.$signature;

        return [
            'token' => $token,
            'expires_at' => Carbon::createFromTimestamp($exp)->toIso8601String(),
            'expires_in_seconds' => self::TOKEN_TTL_SECONDS,
        ];
    }

    /**
     * Verify a dynamic attendance token, validating signature, tenant boundary,
     * expiry, and active student state.
     *
     * @return array{student: Student, payload: array}
     *
     * @throws AttendanceScanException
     */
    public function verifyToken(string $tokenString, Tenant $tenant): array
    {
        $parts = explode('.', trim($tokenString));
        if (count($parts) !== 2) {
            throw new AttendanceScanException('INVALID_QR_TOKEN', 'رمز الاستجابة السريعة (QR) غير صالح أو مشوه.');
        }

        [$b64Payload, $providedSignature] = $parts;

        // 1. Verify HMAC Signature
        $expectedSignature = $this->sign($b64Payload, $tenant);
        if (! hash_equals($expectedSignature, $providedSignature)) {
            throw new AttendanceScanException(
                'INVALID_QR_SIGNATURE',
                'فشل التحقق من صحة رمز الـ QR (توقيع غير صالح أو تم التلاعب به).'
            );
        }

        // 2. Decode JSON Payload
        try {
            $json = $this->base64UrlDecode($b64Payload);
            $payload = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            throw new AttendanceScanException('INVALID_QR_PAYLOAD', 'بيانات الـ QR غير قابلة للقراءة.');
        }

        // 3. Verify Tenant Isolation (SEC-INV-001)
        if (! isset($payload['tenant']) || $payload['tenant'] !== $tenant->id) {
            throw new AttendanceScanException(
                'TENANT_MISMATCH',
                'هذا الرمز صادر لمؤسسة أخرى ولا يمكن استخدامه لتسجيل الحضور هنا.'
            );
        }

        // 4. Verify Expiry (60 seconds)
        $exp = $payload['exp'] ?? 0;
        if ($exp < now()->timestamp) {
            throw new AttendanceScanException(
                'QR_TOKEN_EXPIRED',
                'رمز الاستجابة السريعة (QR) منتهي الصلاحية، يرجى تحديث بطاقة الطالب.'
            );
        }

        // 5. Verify Student Exists & Active
        $studentId = $payload['sub'] ?? null;
        if (! $studentId) {
            throw new AttendanceScanException('INVALID_QR_PAYLOAD', 'رمز الـ QR يفتقر إلى معرف الطالب.');
        }

        $student = Student::with('user')->find($studentId);
        if (! $student) {
            throw new AttendanceScanException('STUDENT_NOT_FOUND', 'الطالب المرتبط بهذا الرمز غير مسجل في هذه المؤسسة.');
        }

        if ($student->status !== 'active') {
            throw new AttendanceScanException('STUDENT_INACTIVE', 'حساب الطالب غير نشط أو معلق.');
        }

        // 6. If Credential Bound (e.g. coupon mode), check not revoked
        if (! empty($payload['cid'])) {
            $credential = DeviceCredential::find($payload['cid']);
            if ($credential && $credential->status === 'revoked') {
                throw new AttendanceScanException('CREDENTIAL_REVOKED', 'تصريح الدخول أو البطاقة ملغاة.');
            }
        }

        return [
            'student' => $student,
            'payload' => $payload,
        ];
    }

    protected function sign(string $data, Tenant $tenant): string
    {
        $appKey = (string) config('app.key');
        $tenantSecret = hash_hmac('sha256', $tenant->id, $appKey);
        $rawSignature = hash_hmac('sha256', $data, $tenantSecret, true);

        return $this->base64UrlEncode($rawSignature);
    }

    protected function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    protected function base64UrlDecode(string $data): string
    {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $padLen = 4 - $remainder;
            $data .= str_repeat('=', $padLen);
        }

        return base64_decode(strtr($data, '-_', '+/'));
    }
}
