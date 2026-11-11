<?php

namespace App\Support\Saudi;

/**
 * Saudi-market input rules: national ID / iqama checksum, mobile numbers, administrative regions and
 * the three school stages. Kept in one place so the API and the registration form agree.
 */
final class SaudiRules
{
    /** The 13 administrative regions (المناطق الإدارية). */
    public const REGIONS = [
        'riyadh' => 'منطقة الرياض',
        'makkah' => 'منطقة مكة المكرمة',
        'madinah' => 'منطقة المدينة المنورة',
        'qassim' => 'منطقة القصيم',
        'eastern' => 'المنطقة الشرقية',
        'asir' => 'منطقة عسير',
        'tabuk' => 'منطقة تبوك',
        'hail' => 'منطقة حائل',
        'northern_borders' => 'منطقة الحدود الشمالية',
        'jazan' => 'منطقة جازان',
        'najran' => 'منطقة نجران',
        'bahah' => 'منطقة الباحة',
        'jawf' => 'منطقة الجوف',
    ];

    /** Stage => [label used in "الصف … {label}", number of grades]. */
    public const STAGES = [
        'primary' => ['label' => 'الابتدائي', 'name' => 'المرحلة الابتدائية', 'grades' => 6],
        'intermediate' => ['label' => 'المتوسط', 'name' => 'المرحلة المتوسطة', 'grades' => 3],
        'secondary' => ['label' => 'الثانوي', 'name' => 'المرحلة الثانوية', 'grades' => 3],
    ];

    private const ORDINALS = [1 => 'الأول', 2 => 'الثاني', 3 => 'الثالث', 4 => 'الرابع', 5 => 'الخامس', 6 => 'السادس'];

    /** Arabic-Indic / Persian digits to ASCII, and strip spaces, dashes and zero-width marks. */
    public static function normalizeDigits(string $value): string
    {
        $value = strtr($value, [
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        ]);

        return preg_replace('/[\s\-\x{200B}-\x{200F}\x{202A}-\x{202E}]/u', '', $value) ?? '';
    }

    /**
     * Canonical Saudi mobile: 05XXXXXXXX. Accepts 05…, 5…, 9665…, +9665…, 009665…; null when not a Saudi mobile.
     */
    public static function normalizeMobile(?string $value): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $digits = self::normalizeDigits($value);
        $digits = ltrim($digits, '+');
        if (str_starts_with($digits, '00966')) {
            $digits = substr($digits, 5);
        } elseif (str_starts_with($digits, '966')) {
            $digits = substr($digits, 3);
        }
        if (str_starts_with($digits, '0')) {
            $digits = substr($digits, 1);
        }

        return preg_match('/^5\d{8}$/', $digits) === 1 ? '0'.$digits : null;
    }

    /** National ID (starts with 1) or iqama (starts with 2): 10 digits with the Luhn-style checksum. */
    public static function isValidNationalId(?string $value): bool
    {
        if ($value === null) {
            return false;
        }

        $id = self::normalizeDigits($value);
        if (preg_match('/^[12]\d{9}$/', $id) !== 1) {
            return false;
        }

        $sum = 0;
        for ($i = 0; $i < 10; $i++) {
            $digit = (int) $id[$i];
            if ($i % 2 === 0) {
                $digit *= 2;
                if ($digit > 9) {
                    $digit -= 9;
                }
            }
            $sum += $digit;
        }

        return $sum % 10 === 0;
    }

    /** Keyed HMAC for duplicate detection without storing the plain ID in an indexed column. */
    public static function hashNationalId(string $value): string
    {
        return hash_hmac('sha256', self::normalizeDigits($value), (string) config('app.key'));
    }

    public static function maskNationalId(string $value): string
    {
        $id = self::normalizeDigits($value);

        return str_repeat('•', max(0, strlen($id) - 4)).substr($id, -4);
    }

    public static function isValidGrade(string $stage, int $grade): bool
    {
        return isset(self::STAGES[$stage]) && $grade >= 1 && $grade <= self::STAGES[$stage]['grades'];
    }

    /** e.g. "الصف الأول الثانوي" — the format the rest of the system already uses for grade_level. */
    public static function gradeLabel(string $stage, int $grade): string
    {
        return 'الصف '.(self::ORDINALS[$grade] ?? $grade).' '.(self::STAGES[$stage]['label'] ?? '');
    }
}
