<?php

namespace App\Domain\Communication;

use Illuminate\Support\Carbon;

/**
 * R8-1: every notification event with its Arabic template, target recipients, and default channels.
 * OD-33: Routing to student and/or parent, plus WhatsApp template mapping.
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

    public const ATTENDANCE_LATE = 'attendance_late';

    public const HOMEWORK_MISSING = 'homework_missing';

    public const SESSION_REMINDER = 'session_reminder';

    public const WEEKLY_REPORT = 'weekly_report';

    public const CREDENTIAL_ISSUED = 'credential_issued';

    public const DEVICE_UNBOUND = 'device_unbound';

    public const SUPPORT_SESSION_STARTED = 'support_session_started';

    /**
     * @return array<string, array{label: string, title: string, message: string, mail: bool, recipients: string, whatsapp_template?: string|null}>
     */
    public static function all(): array
    {
        return [
            self::PAYMENT_SUBMITTED => [
                'label' => 'طلبات دفع جديدة',
                'title' => 'طلب دفع جديد',
                'message' => 'أرسل :student طلب دفع لباقة «:package» بانتظار المراجعة.',
                'mail' => false,
                'recipients' => 'staff',
            ],
            self::PAYMENT_APPROVED => [
                'label' => 'قبول المدفوعات',
                'title' => 'تم قبول الدفع',
                'message' => 'تم قبول طلب الدفع لباقة «:package» وتفعيل الاشتراك.',
                'mail' => true,
                'recipients' => 'both',
                'whatsapp_template' => 'sahaba_payment_approved',
            ],
            self::PAYMENT_REJECTED => [
                'label' => 'رفض المدفوعات',
                'title' => 'تم رفض طلب الدفع',
                'message' => 'تم رفض طلب الدفع لباقة «:package». السبب: :reason',
                'mail' => true,
                'recipients' => 'both',
                'whatsapp_template' => 'sahaba_payment_rejected',
            ],
            self::SUBSCRIPTION_EXPIRING => [
                'label' => 'قرب انتهاء الاشتراك',
                'title' => 'اشتراكك يقترب من الانتهاء',
                'message' => 'ينتهي اشتراك باقة «:package» بتاريخ :date.',
                'mail' => true,
                'recipients' => 'both',
                'whatsapp_template' => 'sahaba_subscription_expiring',
            ],
            self::GRADE_PUBLISHED => [
                'label' => 'نشر الدرجات',
                'title' => 'درجة جديدة',
                'message' => 'تم نشر نتيجة :title.',
                'mail' => false,
                'recipients' => 'both',
                'whatsapp_template' => 'sahaba_grade_published',
            ],
            self::ASSIGNMENT_DUE => [
                'label' => 'قرب موعد الواجبات',
                'title' => 'موعد تسليم قريب',
                'message' => 'موعد تسليم «:title» بتاريخ :date.',
                'mail' => false,
                'recipients' => 'student',
            ],
            self::EXAM_OPENED => [
                'label' => 'فتح الاختبارات',
                'title' => 'اختبار جديد متاح',
                'message' => 'أصبح اختبار «:title» متاحاً الآن.',
                'mail' => false,
                'recipients' => 'student',
            ],
            self::SESSION_SCHEDULED => [
                'label' => 'جدولة الحصص',
                'title' => 'حصة جديدة',
                'message' => 'تمت جدولة حصة «:title» بتاريخ :date.',
                'mail' => false,
                'recipients' => 'student',
            ],
            self::SESSION_CANCELLED => [
                'label' => 'إلغاء الحصص',
                'title' => 'تم إلغاء حصة',
                'message' => 'تم إلغاء حصة «:title».',
                'mail' => false,
                'recipients' => 'both',
            ],
            self::ATTENDANCE_ABSENT => [
                'label' => 'غياب الأبناء',
                'title' => 'تسجيل غياب',
                'message' => 'تم تسجيل غياب :student عن حصة «:title».',
                'mail' => true,
                'recipients' => 'both',
                'whatsapp_template' => 'sahaba_attendance_absent',
            ],
            self::ATTENDANCE_LATE => [
                'label' => 'تأخير الأبناء',
                'title' => 'تسجيل تأخير',
                'message' => 'تم تسجيل تأخير :student عن حصة «:title».',
                'mail' => true,
                'recipients' => 'both',
                'whatsapp_template' => 'sahaba_attendance_late',
            ],
            self::HOMEWORK_MISSING => [
                'label' => 'متابعة الواجبات غير المنجزة',
                'title' => 'عدم تسليم الواجب',
                'message' => 'لم يقم :student بأداء واجب الحصة «:title».',
                'mail' => true,
                'recipients' => 'both',
                'whatsapp_template' => 'sahaba_homework_missing',
            ],
            self::SESSION_REMINDER => [
                'label' => 'تذكير بموعد الحصة',
                'title' => 'تذكير بالحصة القادمة',
                'message' => 'تذكير: لديك حصة «:title» قريباً.',
                'mail' => false,
                'recipients' => 'student',
            ],
            self::WEEKLY_REPORT => [
                'label' => 'التقرير الأسبوعي لولي الأمر',
                'title' => 'التقرير الأسبوعي للطالب',
                'message' => 'إليك التقرير الأسبوعي لأداء :student في الحضور والواجبات والدرجات.',
                'mail' => true,
                'recipients' => 'parent',
                'whatsapp_template' => 'sahaba_weekly_report',
            ],
            self::CREDENTIAL_ISSUED => [
                'label' => 'إصدار أكواد الدخول',
                'title' => 'تم إصدار كود دخول',
                'message' => 'تم إصدار كود دخول لحسابك. استلمه من إدارة الأكاديمية.',
                'mail' => true,
                'recipients' => 'student',
            ],
            self::DEVICE_UNBOUND => [
                'label' => 'فك ربط الأجهزة',
                'title' => 'تم فك ربط جهازك',
                'message' => 'تم فك ربط جهازك بكود الدخول. سيرتبط الكود بالجهاز التالي الذي تسجّل الدخول منه.',
                'mail' => true,
                'recipients' => 'student',
            ],
            self::SUPPORT_SESSION_STARTED => [
                'label' => 'جلسات الدعم الفني',
                'title' => 'بدأت جلسة دعم فني',
                'message' => 'بدأ فريق دعم المنصة جلسة دعم مؤقتة داخل مؤسستك.',
                'mail' => true,
                'recipients' => 'staff',
            ],
        ];
    }

    /**
     * Get target recipient scope ('both' | 'student' | 'parent' | 'staff') for an event.
     */
    public static function recipients(string $event): string
    {
        return self::all()[$event]['recipients'] ?? 'both';
    }

    /**
     * Get approved WhatsApp template name if configured for the event.
     */
    public static function whatsappTemplate(string $event): ?string
    {
        return self::all()[$event]['whatsapp_template'] ?? null;
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
