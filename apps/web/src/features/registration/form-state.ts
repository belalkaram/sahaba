import { isValidNationalId, normalizeMobile, passwordProblem } from '../../lib/saudi';

export interface RegistrationForm {
  full_name: string;
  national_id: string;
  education_stage: string;
  grade: string;
  student_phone: string;
  email: string;
  region: string;
  governorate: string;
  address: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_occupation: string;
  password: string;
  password_confirmation: string;
  tenants: string[];
  /** Honeypot. */
  website: string;
}

export const INITIAL_FORM: RegistrationForm = {
  full_name: '',
  national_id: '',
  education_stage: '',
  grade: '',
  student_phone: '',
  email: '',
  region: '',
  governorate: '',
  address: '',
  guardian_name: '',
  guardian_phone: '',
  guardian_occupation: '',
  password: '',
  password_confirmation: '',
  tenants: [],
  website: '',
};

export const STEPS = [
  { id: 'student', title: 'بيانات الطالب', fields: ['full_name', 'national_id', 'education_stage', 'grade', 'student_phone', 'email'] },
  { id: 'address', title: 'العنوان', fields: ['region', 'governorate', 'address'] },
  { id: 'guardian', title: 'ولي الأمر', fields: ['guardian_name', 'guardian_phone', 'guardian_occupation'] },
  { id: 'security', title: 'كلمة المرور', fields: ['password', 'password_confirmation'] },
  { id: 'academies', title: 'الجهات', fields: ['tenants'] },
  { id: 'review', title: 'المراجعة', fields: [] },
] as const;

export type FieldErrors = Partial<Record<keyof RegistrationForm, string>>;

const required = (v: string, message: string) => (v.trim() === '' ? message : undefined);

/** Client-side mirror of the server rules, per step. The server stays the authority. */
export function validateStep(step: number, f: RegistrationForm): FieldErrors {
  const e: FieldErrors = {};
  switch (STEPS[step].id) {
    case 'student':
      if (f.full_name.trim().length < 6) e.full_name = 'اكتب الاسم الكامل (٦ أحرف على الأقل).';
      if (!isValidNationalId(f.national_id)) e.national_id = 'رقم الهوية غير صحيح (١٠ أرقام تبدأ بـ ١ أو ٢).';
      e.education_stage = required(f.education_stage, 'اختر المرحلة الدراسية.');
      e.grade = required(f.grade, 'اختر الصف.');
      if (!normalizeMobile(f.student_phone)) e.student_phone = 'اكتب جوالًا سعوديًا صحيحًا يبدأ بـ 05.';
      if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'البريد الإلكتروني غير صحيح.';
      break;
    case 'address':
      e.region = required(f.region, 'اختر المنطقة.');
      e.governorate = required(f.governorate, 'اكتب المحافظة أو المدينة.');
      if (f.address.trim().length < 5) e.address = 'اكتب العنوان (٥ أحرف على الأقل).';
      break;
    case 'guardian':
      if (f.guardian_name.trim().length < 6) e.guardian_name = 'اكتب اسم ولي الأمر كاملًا.';
      if (!normalizeMobile(f.guardian_phone)) e.guardian_phone = 'اكتب جوالًا سعوديًا صحيحًا يبدأ بـ 05.';
      else if (normalizeMobile(f.guardian_phone) === normalizeMobile(f.student_phone)) e.guardian_phone = 'يجب أن يختلف جوال ولي الأمر عن جوال الطالب.';
      break;
    case 'security': {
      const problem = passwordProblem(f.password);
      if (problem) e.password = problem;
      if (f.password !== f.password_confirmation) e.password_confirmation = 'كلمتا المرور غير متطابقتين.';
      break;
    }
    case 'academies':
      if (f.tenants.length === 0) e.tenants = 'اختر مؤسسة أو مدرسًا واحدًا على الأقل.';
      break;
  }
  return Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as FieldErrors;
}

/** Index of the step that owns a field (to jump to server-side errors). */
export function stepOfField(field: string): number {
  const i = STEPS.findIndex((s) => (s.fields as readonly string[]).includes(field));
  return i === -1 ? 0 : i;
}
