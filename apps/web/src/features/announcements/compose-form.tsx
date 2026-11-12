'use client';

import React, { useState } from 'react';
import { Bell, CircleAlert, CircleCheck, Info, Megaphone, PanelTop, SquareStack, TriangleAlert, X } from 'lucide-react';
import { ApiError } from '../../lib/api-client';
import {
  announcementApi,
  type Announcement,
  type AnnouncementAudience,
  type AnnouncementDisplay,
  type AnnouncementFrequency,
  type AnnouncementOptions,
  type AnnouncementTone,
} from '../../lib/announcement-api';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';
import { Card, CardHeader } from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import { cn } from '../../lib/cn';
import { AudienceCount, AudiencePicker } from './audience-picker';
import { DISPLAY_COPY, FREQUENCY_COPY, TONE_COPY } from './labels';

const DISPLAY_ICON: Record<AnnouncementDisplay, React.ElementType> = { bell: Bell, banner: PanelTop, modal: SquareStack };
const TONE_ICON: Record<AnnouncementTone, React.ElementType> = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert };
const TONE_BOX: Record<AnnouncementTone, string> = {
  info: 'border-info/30 bg-info-subtle text-info-subtle-fg',
  success: 'border-success/30 bg-success-subtle text-success-subtle-fg',
  warning: 'border-warning/30 bg-warning-subtle text-warning-subtle-fg',
  danger: 'border-danger/30 bg-danger-subtle text-danger-subtle-fg',
};

interface Form {
  title: string;
  body: string;
  display: AnnouncementDisplay;
  frequency: AnnouncementFrequency;
  tone: AnnouncementTone;
  audience: AnnouncementAudience;
  schedule: boolean;
  starts_at: string;
  ends_at: string;
}

const INITIAL: Form = {
  title: '',
  body: '',
  display: 'modal',
  frequency: 'once',
  tone: 'info',
  audience: { target: 'all', ids: [], students: true, parents: false },
  schedule: false,
  starts_at: '',
  ends_at: '',
};

/** `datetime-local` (local time) -> ISO with offset, so the server stores the moment the sender meant. */
function toIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function ComposeAnnouncement({ options, onCreated, onCancel }: { options: AnnouncementOptions; onCreated: (a: Announcement) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Form>({ ...INITIAL, audience: { ...INITIAL.audience, target: options.targets[0] } });
  const [names, setNames] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'اكتب عنواناً قصيراً.';
    if (!form.body.trim()) e.body = 'اكتب نص الإعلان.';
    if (form.audience.target !== 'all' && form.audience.ids.length === 0) e.audience = 'اختر عنصراً واحداً على الأقل.';
    if (!form.audience.students && !form.audience.parents) e.audience = 'اختر الطلاب أو أولياء الأمور أو كليهما.';
    if (form.schedule && form.ends_at && form.starts_at && new Date(form.ends_at) <= new Date(form.starts_at)) e.ends_at = 'النهاية يجب أن تكون بعد البداية.';
    if (form.schedule && form.ends_at && new Date(form.ends_at) <= new Date()) e.ends_at = 'النهاية يجب أن تكون في المستقبل.';
    return e;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const created = await announcementApi.create({
        title: form.title.trim(),
        body: form.body.trim(),
        display: form.display,
        frequency: form.display === 'bell' ? null : form.frequency,
        tone: form.tone,
        audience: form.audience,
        starts_at: form.schedule && form.display !== 'bell' ? toIso(form.starts_at) : null,
        ends_at: form.schedule ? toIso(form.ends_at) : null,
      });
      onCreated(created);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMPTY_AUDIENCE') setFailure('لا يوجد أي مستلم بهذا الاختيار. راجع الفئة أو فعّل أولياء الأمور.');
      else if (err instanceof ApiError && err.status === 403) setFailure('لا تملك صلاحية مخاطبة هذه الفئة.');
      else if (err instanceof ApiError && err.status === 422) setFailure('راجع الحقول ثم أعد المحاولة.');
      else setFailure('تعذّر نشر الإعلان. تحقق من الاتصال وحاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" noValidate>
      <div className="space-y-6">
        <Card>
          <CardHeader title="١. نص الإعلان" />
          <div className="space-y-4">
            <Input label="العنوان" value={form.title} maxLength={150} onChange={(e) => set('title', e.target.value)} error={errors.title} required />
            <Textarea label="النص" rows={5} value={form.body} maxLength={5000} onChange={(e) => set('body', e.target.value)} error={errors.body} required />
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-fg">الطابع</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TONE_COPY) as AnnouncementTone[]).map((t) => {
                  const Icon = TONE_ICON[t];
                  return (
                    <button key={t} type="button" onClick={() => set('tone', t)} aria-pressed={form.tone === t} className={cn('inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm', form.tone === t ? TONE_BOX[t] + ' font-semibold' : 'border-border hover:bg-surface-muted')}>
                      <Icon size={15} aria-hidden /> {TONE_COPY[t]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        </Card>

        <Card>
          <CardHeader title="٢. المستلمون" description="حدّد بالضبط من يصله الإعلان." />
          <AudiencePicker options={options} value={form.audience} onChange={(a) => set('audience', a)} studentNames={names} onStudentNames={setNames} error={errors.audience} />
          <div className="mt-4">
            <AudienceCount audience={form.audience} />
          </div>
        </Card>

        <Card>
          <CardHeader title="٣. طريقة الظهور" />
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(DISPLAY_COPY) as AnnouncementDisplay[]).map((d) => {
              const Icon = DISPLAY_ICON[d];
              const on = form.display === d;
              return (
                <button key={d} type="button" onClick={() => set('display', d)} aria-pressed={on} className={cn('rounded-lg border p-3 text-start transition-colors', on ? 'border-primary bg-primary-subtle' : 'border-border hover:bg-surface-muted')}>
                  <span className="flex items-center gap-2 font-semibold text-fg">
                    <Icon size={18} aria-hidden /> {DISPLAY_COPY[d].label}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-fg-muted">{DISPLAY_COPY[d].hint}</span>
                </button>
              );
            })}
          </div>
          {form.display !== 'bell' && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(Object.keys(FREQUENCY_COPY) as AnnouncementFrequency[]).map((f) => (
                <label key={f} className={cn('flex cursor-pointer items-start gap-2 rounded-lg border p-3', form.frequency === f ? 'border-primary bg-primary-subtle' : 'border-border')}>
                  <input type="radio" name="frequency" className="mt-1" checked={form.frequency === f} onChange={() => set('frequency', f)} />
                  <span>
                    <span className="block font-semibold text-fg">{FREQUENCY_COPY[f].label}</span>
                    <span className="block text-xs text-fg-muted">{FREQUENCY_COPY[f].hint}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <Switch checked={form.schedule} onChange={(v) => set('schedule', v)} label={form.display === 'bell' ? 'تحديد تاريخ انتهاء' : 'جدولة البداية و/أو النهاية'} />
            {form.schedule && (
              <div className="grid gap-3 sm:grid-cols-2">
                {form.display !== 'bell' && <Input label="يبدأ في (اختياري)" type="datetime-local" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} dir="ltr" />}
                <Input label="ينتهي في (اختياري)" type="datetime-local" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} error={errors.ends_at} dir="ltr" />
              </div>
            )}
          </div>
        </Card>

        {failure && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger-subtle p-3 text-sm font-medium text-danger-subtle-fg">
            {failure}
          </p>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            إلغاء
          </Button>
          <Button type="submit" isLoading={saving}>
            <Megaphone size={16} aria-hidden /> نشر الإعلان
          </Button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader title="معاينة" description="هكذا يراه الطالب أو ولي الأمر." />
          <Preview form={form} />
        </Card>
      </aside>
    </form>
  );
}

function Preview({ form }: { form: Form }) {
  const Icon = TONE_ICON[form.tone];
  const title = form.title.trim() || 'عنوان الإعلان';
  const body = form.body.trim() || 'نص الإعلان يظهر هنا.';

  if (form.display === 'bell') {
    return (
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-fg-muted">
          <Bell size={14} aria-hidden /> الإشعارات
        </p>
        <div className="rounded-md bg-primary-subtle/50 p-3">
          <p className="text-sm font-bold text-fg">{title}</p>
          <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-xs text-fg-muted">{body}</p>
        </div>
      </div>
    );
  }

  if (form.display === 'banner') {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-surface-sunken p-2">
        <div className={cn('flex items-start gap-2 rounded-md border px-3 py-2', TONE_BOX[form.tone])}>
          <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{title}</p>
            <p className="whitespace-pre-line break-words text-xs">{body}</p>
          </div>
          <X size={14} aria-hidden />
        </div>
        <div className="h-16 rounded-md bg-surface-muted" aria-hidden />
      </div>
    );
  }

  return (
    <div className="relative grid min-h-48 place-items-center overflow-hidden rounded-lg bg-surface-overlay p-3">
      <div className="w-full overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg">
        <div className={cn('flex items-center gap-2 border-b px-3 py-2', TONE_BOX[form.tone])}>
          <Icon size={16} aria-hidden />
          <p className="min-w-0 flex-1 truncate text-sm font-bold">{title}</p>
          <X size={16} aria-hidden />
        </div>
        <p className="whitespace-pre-line break-words px-3 py-3 text-xs text-fg">{body}</p>
      </div>
    </div>
  );
}
