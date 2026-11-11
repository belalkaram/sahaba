'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api-client';
import { registrationApi, type RegistrationOptions, type RegistrationResult } from '../../lib/public-api';
import { normalizeMobile } from '../../lib/saudi';
import { normalizeDigits } from '../../lib/format';
import { buttonClasses } from '../../components/ui/button-styles';
import { ErrorState } from '../../components/ui/error-state';
import { cn } from '../../lib/cn';
import { FieldErrors, INITIAL_FORM, RegistrationForm, STEPS, stepOfField, validateStep } from './form-state';
import { RegistrationProgress } from './registration-progress';
import { AddressStep, GuardianStep, SecurityStep, StudentStep } from './step-fields';
import { AcademiesStep } from './step-academies';
import { RegistrationDone, ReviewStep } from './step-review';

/** Multi-step student registration with a progress bar. Nothing is sent until the final step. */
export function RegistrationFlow() {
  const [options, setOptions] = useState<RegistrationOptions | null>(null);
  const [optionsError, setOptionsError] = useState(false);
  const [form, setForm] = useState<RegistrationForm>(INITIAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [results, setResults] = useState<RegistrationResult[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const heading = useRef<HTMLHeadingElement>(null);

  const loadOptions = useCallback(() => {
    setOptionsError(false);
    registrationApi.options().then(setOptions).catch(() => setOptionsError(true));
  }, []);
  useEffect(loadOptions, [loadOptions]);

  // Keep keyboard/screen-reader focus on the step title when the step changes.
  useEffect(() => heading.current?.focus(), [step]);

  const set = useCallback(<K extends keyof RegistrationForm>(key: K, value: RegistrationForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }, []);

  const next = () => {
    const found = validateStep(step, form);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const out = await registrationApi.submit({
        ...form,
        national_id: normalizeDigits(form.national_id),
        student_phone: normalizeMobile(form.student_phone) ?? form.student_phone,
        guardian_phone: normalizeMobile(form.guardian_phone) ?? form.guardian_phone,
        grade: Number(form.grade),
      });
      setResults(out.map((r) => ({ ...r, name: r.name ?? names[r.slug] ?? null })));
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.details) {
        // Show the server's field messages on the step that owns the field.
        const fieldErrors: FieldErrors = {};
        for (const [field, msgs] of Object.entries(err.details)) {
          const message = Array.isArray(msgs) ? String(msgs[0]) : String(msgs);
          fieldErrors[field as keyof RegistrationForm] = message;
        }
        const first = Object.keys(fieldErrors)[0];
        setErrors(fieldErrors);
        if (first) setStep(stepOfField(first));
        setSubmitError('راجع الحقول المعلَّمة ثم أعد الإرسال.');
      } else if (err instanceof ApiError && err.status === 429) {
        setSubmitError('محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.');
      } else {
        setSubmitError('تعذّر إرسال الطلب. تحقق من الاتصال وحاول مرة أخرى.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (optionsError) return <ErrorState title="تعذّر تحميل نموذج التسجيل" description="تحقق من الاتصال ثم أعد المحاولة." onRetry={loadOptions} />;
  if (!options) return <div className="h-72 animate-pulse rounded-xl bg-surface-muted" aria-busy="true" />;
  if (results) return <RegistrationDone results={results} />;

  const last = step === STEPS.length - 1;
  const props = { form, errors, set };

  return (
    <div className="space-y-8">
      <RegistrationProgress current={step} onJump={(s) => setStep(s)} />

      <div>
        <h2 ref={heading} tabIndex={-1} className="mb-5 font-display text-2xl text-fg outline-none">
          {STEPS[step].title}
        </h2>
        {/* Honeypot: invisible to people, tempting to bots. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden value={form.website} onChange={(e) => set('website', e.target.value)} className="absolute -start-[9999px] h-0 w-0 opacity-0" />

        {step === 0 && <StudentStep {...props} options={options} />}
        {step === 1 && <AddressStep {...props} options={options} />}
        {step === 2 && <GuardianStep {...props} />}
        {step === 3 && <SecurityStep {...props} />}
        {step === 4 && (
          <AcademiesStep
            selected={form.tenants}
            max={options.max_tenants}
            error={errors.tenants}
            onChange={(slugs, picked) => {
              set('tenants', slugs);
              setNames((prev) => ({ ...prev, ...picked }));
            }}
          />
        )}
        {step === 5 && <ReviewStep form={form} options={options} names={names} onEdit={setStep} />}
      </div>

      {submitError && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-subtle p-3 text-sm font-medium text-danger-subtle-fg">
          {submitError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting} className={cn(buttonClasses('secondary', 'lg'), 'sm:w-40')}>
          السابق
        </button>
        {last ? (
          <button type="button" onClick={submit} disabled={submitting} className={cn(buttonClasses('primary', 'lg'), 'sm:min-w-48')}>
            {submitting ? 'جارٍ الإرسال…' : 'إرسال الطلب'}
          </button>
        ) : (
          <button type="button" onClick={next} className={cn(buttonClasses('primary', 'lg'), 'sm:w-40')}>
            التالي
          </button>
        )}
      </div>
    </div>
  );
}
