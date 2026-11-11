import React from 'react';
import Link from 'next/link';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { academyLoginHref, registrationStatusHref, type RegistrationOptions, type RegistrationResult } from '../../lib/public-api';
import { normalizeMobile } from '../../lib/saudi';
import { buttonClasses } from '../../components/ui/button-styles';
import { formatNumber } from '../../lib/format';
import { STEPS, type RegistrationForm } from './form-state';

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className={ltr ? 'ltr-isolate break-all text-sm font-semibold text-fg' : 'break-words text-sm font-semibold text-fg'}>{value || '—'}</dd>
    </div>
  );
}

export function ReviewStep({ form, options, names, onEdit }: { form: RegistrationForm; options: RegistrationOptions; names: Record<string, string>; onEdit: (step: number) => void }) {
  const stage = options.stages.find((s) => s.value === form.education_stage)?.label;
  const region = options.regions.find((r) => r.value === form.region)?.label;
  const sections = [
    {
      step: 0,
      rows: [
        ['الاسم الكامل', form.full_name],
        ['رقم الهوية', `••••••${form.national_id.slice(-4)}`, true],
        ['المرحلة والصف', `${stage ?? ''} — الصف ${formatNumber(Number(form.grade))}`],
        ['جوال الطالب', normalizeMobile(form.student_phone) ?? form.student_phone, true],
        ['البريد الإلكتروني', form.email, true],
      ],
    },
    {
      step: 1,
      rows: [
        ['المنطقة', region ?? ''],
        ['المحافظة / المدينة', form.governorate],
        ['العنوان', form.address],
      ],
    },
    {
      step: 2,
      rows: [
        ['ولي الأمر', form.guardian_name],
        ['جوال ولي الأمر', normalizeMobile(form.guardian_phone) ?? form.guardian_phone, true],
        ['مهنة ولي الأمر', form.guardian_occupation],
      ],
    },
    { step: 4, rows: [['الجهات المختارة', form.tenants.map((s) => names[s] ?? s).join('، ')]] },
  ] as const;

  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <section key={s.step} className="rounded-lg border border-border bg-surface-sunken p-4">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-bold text-fg">{STEPS[s.step].title}</h3>
            <button type="button" onClick={() => onEdit(s.step)} className="text-sm font-semibold text-primary hover:underline">
              تعديل
            </button>
          </div>
          <dl className="divide-y divide-border">
            {s.rows.map((r) => (
              <Row key={r[0]} label={r[0]} value={r[1]} ltr={'2' in r ? Boolean(r[2]) : false} />
            ))}
          </dl>
        </section>
      ))}
      <p className="text-sm text-fg-muted">بإرسال الطلب تؤكد أن البيانات صحيحة، وتوافق على معالجتها لغرض التسجيل. تُشفَّر بيانات الهوية ولا يراها إلا من تُقدَّم إليه.</p>
    </div>
  );
}

const STATUS_COPY: Record<RegistrationResult['status'], string> = {
  submitted: 'تم إرسال الطلب',
  unavailable: 'لم تعد هذه الجهة تستقبل طلبات',
  failed: 'تعذّر إرسال الطلب لهذه الجهة',
};

export function RegistrationDone({ results }: { results: RegistrationResult[] }) {
  const submitted = results.filter((r) => r.status === 'submitted');
  const ok = submitted.length;
  // One academy: send the student straight to its sign-in page with the academy code filled in.
  const loginHref = ok === 1 ? academyLoginHref(submitted[0].slug) : '/login';
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${ok ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>
          {ok ? <CheckCircle2 size={30} aria-hidden /> : <CircleAlert size={30} aria-hidden />}
        </span>
        <h2 className="font-display text-2xl text-fg">{ok ? 'وصل طلبك' : 'لم يُرسَل الطلب'}</h2>
        <p className="mx-auto max-w-lg text-fg-muted">
          {ok
            ? 'تراجع كل جهة طلبك على حدة. عند القبول سجّل الدخول بـ «رمز الأكاديمية» ورقم جوال الطالب وكلمة المرور التي اخترتها.'
            : 'لا توجد جهة استقبلت طلبك. جرّب مرة أخرى أو اختر جهات أخرى.'}
        </p>
      </div>
      {ok > 0 && (
        <p className="rounded-md border border-warning/30 bg-warning-subtle p-3 text-sm font-medium text-warning-subtle-fg">
          احتفظ برمز الأكاديمية ورقم الطلب (صوّر هذه الصفحة)، تحتاجهما لمتابعة الطلب ولتسجيل الدخول.
        </p>
      )}
      <ul className="space-y-3">
        {results.map((r) => (
          <li key={r.slug} className="space-y-3 rounded-lg border border-border bg-surface-sunken p-4">
            <div className="min-w-0">
              <p className="break-words font-bold text-fg">{r.name ?? r.slug}</p>
              <p className={r.status === 'submitted' ? 'text-sm text-success' : 'text-sm text-danger'}>{STATUS_COPY[r.status]}</p>
            </div>
            {r.status === 'submitted' && (
              <>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-xs text-fg-muted">رمز الأكاديمية</dt>
                    <dd className="ltr-isolate break-all font-mono text-sm font-bold text-fg">{r.slug}</dd>
                  </div>
                  {r.reference_code && (
                    <div className="min-w-0">
                      <dt className="text-xs text-fg-muted">رقم الطلب</dt>
                      <dd className="ltr-isolate break-all font-mono text-sm font-bold text-fg">{r.reference_code}</dd>
                    </div>
                  )}
                </dl>
                <div className="flex flex-wrap gap-2">
                  {r.reference_code && (
                    <Link href={registrationStatusHref(r.slug, r.reference_code)} className={buttonClasses('secondary', 'sm')}>
                      متابعة حالة الطلب
                    </Link>
                  )}
                  <Link href={academyLoginHref(r.slug)} className={buttonClasses('ghost', 'sm')}>
                    صفحة الدخول لهذه الجهة
                  </Link>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href={loginHref} className={buttonClasses('primary', 'lg')}>
          الذهاب إلى تسجيل الدخول
        </Link>
        <Link href="/" className={buttonClasses('secondary', 'lg')}>
          الصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
