/**
 * Central display formatting (OD-17, OD-18). Never call toLocale*String('ar-SA') directly:
 * bare `ar-SA` silently switches to the Hijri calendar. Every formatter here pins the
 * calendar and the numbering system explicitly.
 *
 * - Displayed numbers use Arabic-Indic digits (nu-arab).
 * - Identifiers (emails, codes, OTPs, phone numbers, IBANs, slugs) are NOT formatted here;
 *   render them as typed inside <Ltr>.
 * - Inputs accept both digit sets; call normalizeDigits() before sending values to the API.
 */

const LOCALE_NUM = 'ar-SA-u-nu-arab';
const LOCALE_GREGORY = 'ar-SA-u-ca-gregory-nu-arab';
const LOCALE_HIJRI = 'ar-SA-u-ca-islamic-umalqura-nu-arab';

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>();

function nf(options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `n:${JSON.stringify(options)}`;
  if (!cache.has(key)) cache.set(key, new Intl.NumberFormat(LOCALE_NUM, options));
  return cache.get(key) as Intl.NumberFormat;
}

function df(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `d:${locale}:${JSON.stringify(options)}`;
  if (!cache.has(key)) cache.set(key, new Intl.DateTimeFormat(locale, options));
  return cache.get(key) as Intl.DateTimeFormat;
}

/* ------------------------------------------------------------------------- */
/* Numbers                                                                    */
/* ------------------------------------------------------------------------- */

export function formatNumber(value: number | null | undefined, maximumFractionDigits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return nf({ maximumFractionDigits }).format(value);
}

/** `value` is a percentage number (85 → «٨٥٪»), not a ratio. */
export function formatPercent(value: number | null | undefined, maximumFractionDigits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return nf({ style: 'percent', maximumFractionDigits }).format(value / 100);
}

/** KPI value: "50.00%" (counts up in KpiCard), or an em dash when the metric was not computed. */
export function pctValue(value: number | string | null | undefined): string {
  return value === null || value === undefined ? '—' : `${value}%`;
}

export function formatCurrency(
  value: number | string | null | undefined,
  currency = 'SAR',
  maximumFractionDigits = 2,
): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return nf({ style: 'currency', currency, maximumFractionDigits, minimumFractionDigits: 0 }).format(n);
}

/** Converts any Western digits in a display string (e.g. "3 دقائق") to Arabic-Indic. */
export function toArabicDigits(text: string | number): string {
  return String(text).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

/** Normalizes Arabic-Indic (٠-٩) and Persian (۰-۹) digits to 0-9 — use before API calls. */
export function normalizeDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/* ------------------------------------------------------------------------- */
/* Dates                                                                      */
/* ------------------------------------------------------------------------- */

/** «١٢ نوفمبر ٢٠٢٦م» */
export function formatDate(value: DateInput, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  const d = toDate(value);
  if (!d) return '—';
  return df(LOCALE_GREGORY, options).format(d);
}

/** «١٢ نوف» — for dense tables */
export function formatDateShort(value: DateInput): string {
  return formatDate(value, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** «٢١ جمادى الأولى ١٤٤٨ هـ» (Umm al-Qura) */
export function formatHijri(value: DateInput): string {
  const d = toDate(value);
  if (!d) return '—';
  return df(LOCALE_HIJRI, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

/** «١٢ نوفمبر ٢٠٢٦م · ٢١ جمادى الأولى ١٤٤٨ هـ» */
export function formatDual(value: DateInput): string {
  const d = toDate(value);
  if (!d) return '—';
  return `${formatDate(d)} · ${formatHijri(d)}`;
}

/** «٤:٣٠ م» */
export function formatTime(value: DateInput): string {
  const d = toDate(value);
  if (!d) return '—';
  return df(LOCALE_GREGORY, { hour: 'numeric', minute: '2-digit' }).format(d);
}

export function formatDateTime(value: DateInput): string {
  const d = toDate(value);
  if (!d) return '—';
  return df(LOCALE_GREGORY, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
}

/** «منذ ٣ ساعات» / «بعد يومين» */
export function formatRelative(value: DateInput, now: Date = new Date()): string {
  const d = toDate(value);
  if (!d) return '—';
  const key = 'r';
  if (!cache.has(key)) cache.set(key, new Intl.RelativeTimeFormat(LOCALE_NUM, { numeric: 'auto' }));
  const rtf = cache.get(key) as Intl.RelativeTimeFormat;
  const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), 'month');
  return rtf.format(Math.round(diffSec / (86400 * 365)), 'year');
}
