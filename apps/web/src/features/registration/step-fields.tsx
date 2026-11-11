'use client';

import React from 'react';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import type { RegistrationOptions } from '../../lib/public-api';
import { passwordStrength } from '../../lib/saudi';
import { cn } from '../../lib/cn';
import type { FieldErrors, RegistrationForm } from './form-state';

interface StepProps {
  form: RegistrationForm;
  errors: FieldErrors;
  set: <K extends keyof RegistrationForm>(key: K, value: RegistrationForm[K]) => void;
}

const grid = 'grid gap-4 sm:grid-cols-2';

export function StudentStep({ form, errors, set, options }: StepProps & { options: RegistrationOptions }) {
  const stage = options.stages.find((s) => s.value === form.education_stage);
  return (
    <div className={grid}>
      <div className="sm:col-span-2">
        <Input label="الاسم الكامل" required autoComplete="name" value={form.full_name} error={errors.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="كما في الهوية" />
      </div>
      <Input
        label="رقم الهوية / الإقامة"
        required
        inputMode="numeric"
        maxLength={10}
        dir="ltr"
        className="text-start"
        value={form.national_id}
        error={errors.national_id}
        helperText="١٠ أرقام تبدأ بـ ١ للمواطنين أو ٢ للمقيمين."
        onChange={(e) => set('national_id', e.target.value)}
      />
      <Input
        label="جوال الطالب"
        required
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        dir="ltr"
        value={form.student_phone}
        error={errors.student_phone}
        helperText="مثال: 05XXXXXXXX — به تسجّل الدخول لاحقًا."
        onChange={(e) => set('student_phone', e.target.value)}
      />
      <Select
        label="المرحلة الدراسية"
        required
        placeholder="اختر المرحلة"
        value={form.education_stage}
        error={errors.education_stage}
        options={options.stages.map((s) => ({ value: s.value, label: s.label }))}
        onChange={(e) => {
          set('education_stage', e.target.value);
          set('grade', '');
        }}
      />
      <Select
        label="الصف"
        required
        placeholder={stage ? 'اختر الصف' : 'اختر المرحلة أولًا'}
        disabled={!stage}
        value={form.grade}
        error={errors.grade}
        options={Array.from({ length: stage?.grades ?? 0 }, (_, i) => ({ value: String(i + 1), label: `الصف ${GRADE_NAMES[i]}` }))}
        onChange={(e) => set('grade', e.target.value)}
      />
      <div className="sm:col-span-2">
        <Input label="البريد الإلكتروني (اختياري)" type="email" dir="ltr" autoComplete="email" value={form.email} error={errors.email} onChange={(e) => set('email', e.target.value)} />
      </div>
    </div>
  );
}

const GRADE_NAMES = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'];

export function AddressStep({ form, errors, set, options }: StepProps & { options: RegistrationOptions }) {
  return (
    <div className={grid}>
      <Select label="المنطقة" required placeholder="اختر المنطقة" value={form.region} error={errors.region} options={options.regions} onChange={(e) => set('region', e.target.value)} />
      <Input label="المحافظة / المدينة" required value={form.governorate} error={errors.governorate} onChange={(e) => set('governorate', e.target.value)} />
      <div className="sm:col-span-2">
        <Textarea label="العنوان" required rows={3} value={form.address} error={errors.address} onChange={(e) => set('address', e.target.value)} placeholder="الحي، الشارع، أقرب معلم" />
      </div>
    </div>
  );
}

export function GuardianStep({ form, errors, set }: StepProps) {
  return (
    <div className={grid}>
      <div className="sm:col-span-2">
        <Input label="اسم ولي الأمر" required value={form.guardian_name} error={errors.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} />
      </div>
      <Input
        label="جوال ولي الأمر"
        required
        type="tel"
        inputMode="tel"
        dir="ltr"
        value={form.guardian_phone}
        error={errors.guardian_phone}
        helperText="سيدخل به ولي الأمر إلى المنصة لمتابعة ابنه."
        onChange={(e) => set('guardian_phone', e.target.value)}
      />
      <Input label="مهنة ولي الأمر" value={form.guardian_occupation} error={errors.guardian_occupation} onChange={(e) => set('guardian_occupation', e.target.value)} />
    </div>
  );
}

const STRENGTH = [
  { label: 'ضعيفة جدًا', color: 'bg-danger' },
  { label: 'ضعيفة', color: 'bg-danger' },
  { label: 'مقبولة', color: 'bg-warning' },
  { label: 'جيدة', color: 'bg-success' },
  { label: 'قوية', color: 'bg-success' },
];

export function SecurityStep({ form, errors, set }: StepProps) {
  const score = form.password ? passwordStrength(form.password) : 0;
  return (
    <div className="grid max-w-md gap-4">
      <Input label="كلمة المرور" required type="password" autoComplete="new-password" dir="ltr" value={form.password} error={errors.password} helperText="٨ أحرف على الأقل، وتحتوي على حروف وأرقام." onChange={(e) => set('password', e.target.value)} />
      {form.password && (
        <div aria-live="polite" className="space-y-1.5">
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={cn('h-1.5 rounded-full bg-surface-muted', n <= score && STRENGTH[score].color)} />
            ))}
          </div>
          <p className="text-xs text-fg-muted">قوة كلمة المرور: {STRENGTH[score].label}</p>
        </div>
      )}
      <Input label="تأكيد كلمة المرور" required type="password" autoComplete="new-password" dir="ltr" value={form.password_confirmation} error={errors.password_confirmation} onChange={(e) => set('password_confirmation', e.target.value)} />
    </div>
  );
}
