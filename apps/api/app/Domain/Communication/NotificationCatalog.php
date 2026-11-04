<?php

namespace App\Domain\Communication;

use Illuminate\Support\Carbon;

/**
 * R8-1: every notification event with its Arabic template and default channels.
 * Templates must never contain secrets (credential secrets, tokens, codes).
 */
final class NotificationCatalog
{
    public const PAYMENT_SUBMITTED = 'payment_submitted';

    public const PAYMENT_APPROVED = 'payment_approved';

    public const PAYMENT_REJECTED = 'payment_rejected';

    public const SUBSCRIPTION_EXPIRING = 'subscription_expiring';

    public const GRADE_PUBLISHED = 'grade_published';

    public const ASSIGNMENT_DUE = 'assignment_due';

    public const EXAM_OPENED = 'exam_opened';

    public const SESSION_SCHEDULED = 'session_scheduled';

    public const SESSION_CANCELLED = 'session_cancelled';

    public const ATTENDANCE_ABSENT = 'attendance_absent';

    public const CREDENTIAL_ISSUED = 'credential_issued';

    public const DEVICE_UNBOUND = 'device_unbound';

    public const SUPPORT_SESSION_STARTED = 'support_session_started';

    /**
     * @return array<string, array{label: string, title: string, message: string, mail: bool}>
     */
    public static function all(): array
    {
        return [
            self::PAYMENT_SUBMITTED => [
                'label' => 'طلبات دفع جديدة',
                'title' => 'طلب دفع جديد',
                'message' => 'أرسل :student طلب دفع لباقة «:package» بانتظار المراجعة.',
                'mail' => false,
            ],
            self::PAYMENT_APPROVED => [
                'label' => 'قبول المدفوعات',
                'title' => 'تم قبول الدفع',
                'message' => 'تم قبول طلب الدفع لباقة «:package» وتفعيل الاشتراك.',
                'mail' => true,
            ],
            self::PAYMENT_REJECTED => [
                'label' => 'رفض المدفوعات',
                'title' => 'تم رفض طلب الدفع',
                'message' => 'تم رفض طلب الدفع لباقة «:package». السبب: :reason',
                'mail' => true,
            ],
            self::SUBSCRIPTION_EXPIRING => [
                'label' => 'قرب انتهاء الاشتراك',
                'title' => 'اشتراكك يقترب من الانتهاء',
                'message' => 'ينتهي اشتراك باقة «:package» بتاريخ :date.',
                'mail' => true,
            ],
            self::GRADE_PUBLISHED => [
                'label' => 'نشر الدرجات',
                'title' => 'درجة جديدة',
                'message' => 'تم نشر نتيجة «:title».',
                'mail' => false,
            ],
            self::ASSIGNMENT_DUE => [
                'label' => 'قرب موعد الواجبات',
                'title' => 'موعد تسليم قريب',
                'message' => 'موعد تسليم «:title» بتاريخ :date.',
                'mail' => false,
            ],
            self::EXAM_OPENED => [
                'label' => 'فتح الاختبارات',
                'title' => 'اختبار جديد متاح',
                'message' => 'أصبح اختبار «:title» متاحاً الآن.',
                'mail' => false,
            ],
            self::SESSION_SCHEDULED => [
                'label' => 'جدولة الحصص',
                'title' => 'حصة جديدة',
                'message' => 'تمت جدولة حصة «:title» بتاريخ :date.',
                'mail' => false,
            ],
            self::SESSION_CANCELLED => [
                'label' => 'إلغاء الحصص',
                'title' => 'تم إلغاء حصة',
                'message' => 'تم إلغاء حصة «:title».',
                'mail' => false,
            ],
            self::ATTENDANCE_ABSENT => [
                'label' => 'غياب الأبناء',
                'title' => 'تسجيل غياب',
                'message' => 'تم تسجيل غياب :student عن حصة «:title».',
                'mail' => true,
            ],
            self::CREDENTIAL_ISSUED => [
                'label' => 'إصدار أكواد الدخول',
                'title' => 'تم إصدار كود دخول',
                'message' => 'تم إصدار كود دخول لحسابك. استلمه من إدارة الأكاديمية.',
                'mail' => true,
            ],
            self::DEVICE_UNBOUND => [
                'label' => 'فك ربط الأجهزة',
                'title' => 'تم فك ربط جهازك',
                'message' => 'تم فك ربط جهازك بكود الدخول. سيرتبط الكود بالجهاز التالي الذي تسجّل الدخول منه.',
                'mail' => true,
            ],
            self::SUPPORT_SESSION_STARTED => [
                'label' => 'جلسات الدعم الفني',
                'title' => 'بدأت جلسة دعم فني',
                'message' => 'بدأ فريق دعم المنصة جلسة دعم مؤقتة داخل مؤسستك.',
                'mail' => true,
            ],
        ];
    }

    /**
     * «١٢ نوفمبر ٢٠٢٦» (Gregorian, Arabic-Indic digits, OD-17/OD-18).
     */
    public static function date(mixed $value): string
    {
        if (! $value) {
            return '—';
        }

        $text = Carbon::parse($value)->locale('ar')->translatedFormat('j F Y');

        return strtr($text, array_combine(range(0, 9), ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']));
    }

    public static function has(string $event): bool
    {
        return array_key_exists($event, self::all());
    }

    /**
     * @param  array<string, scalar|null>  $params
     */
    public static function render(string $template, array $params): string
    {
        foreach ($params as $key => $value) {
            $template = str_replace(':'.$key, (string) $value, $template);
        }

        return $template;
    }
}
