/**
 * Saudi-market input helpers. The API validates the same rules (App\Support\Saudi\SaudiRules);
 * these only give the applicant instant feedback.
 */
import { normalizeDigits } from './format';

/** Canonical Saudi mobile 05XXXXXXXX from 05…, 5…, 9665…, +9665…, 009665… (Arabic digits accepted); null if invalid. */
export function normalizeMobile(value: string): string | null {
  let d = normalizeDigits(value).replace(/^\+/, '');
  if (d.startsWith('00966')) d = d.slice(5);
  else if (d.startsWith('966')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return /^5\d{8}$/.test(d) ? `0${d}` : null;
}

/** National ID (1…) or iqama (2…): 10 digits plus the checksum. */
export function isValidNationalId(value: string): boolean {
  const id = normalizeDigits(value);
  if (!/^[12]\d{9}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let digit = Number(id[i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'كلمة المرور يجب ألا تقل عن ٨ أحرف.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'كلمة المرور يجب أن تحتوي على حروف وأرقام.';
  return null;
}

/** 0–4 strength for the meter (length + character variety). */
export function passwordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password) || (/[a-z]/.test(password) && /[A-Z]/.test(password))) score++;
  return score;
}
