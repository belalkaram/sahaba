'use client';

/**
 * TL-6 (ADR-007): Contact section editor.
 * Each field has an independent publish toggle — the default is hidden (ADR §4.4).
 * Phone/WhatsApp accept E.164 only. URLs must start with https://.
 * Plain text only — no HTML injection surface.
 */
import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../../lib/cn';

export interface ContactContent {
  phone?: string;
  phone_published?: boolean;
  whatsapp?: string;
  whatsapp_published?: boolean;
  email?: string;
  email_published?: boolean;
  address?: string;
  address_published?: boolean;
  map_url?: string;
  map_url_published?: boolean;
}

interface Props {
  value: ContactContent;
  onChange: (v: ContactContent) => void;
}

interface FieldDef {
  key: keyof ContactContent;
  publishKey: keyof ContactContent;
  label: string;
  placeholder: string;
  type: 'tel' | 'email' | 'url' | 'text';
  hint: string;
}

const FIELDS: FieldDef[] = [
  { key: 'phone',   publishKey: 'phone_published',   label: 'رقم الهاتف',    placeholder: '+966500000000', type: 'tel',   hint: 'صيغة E.164 — ابدأ بـ +'    },
  { key: 'whatsapp',publishKey: 'whatsapp_published', label: 'واتساب',        placeholder: '+966500000000', type: 'tel',   hint: 'صيغة E.164 — ابدأ بـ +'    },
  { key: 'email',   publishKey: 'email_published',   label: 'البريد الإلكتروني', placeholder: 'info@example.com', type: 'email', hint: ''                      },
  { key: 'address', publishKey: 'address_published', label: 'العنوان',        placeholder: 'الرياض، حي النخيل، شارع…', type: 'text', hint: ''                 },
  { key: 'map_url', publishKey: 'map_url_published', label: 'رابط الخريطة',  placeholder: 'https://maps.google.com/…', type: 'url',  hint: 'https:// فقط'    },
];

function ContactField({
  def, value, published, onValue, onPublished,
}: {
  def: FieldDef;
  value: string;
  published: boolean;
  onValue: (v: string) => void;
  onPublished: (v: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-fg" htmlFor={`contact-${def.key}`}>
          {def.label}
          {def.hint && <span className="ms-1 text-xs font-normal text-fg-muted">— {def.hint}</span>}
        </label>

        {/* Publish toggle */}
        <button
          type="button"
          onClick={() => onPublished(!published)}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
            published
              ? 'bg-primary-subtle text-primary-subtle-fg'
              : 'bg-surface-muted text-fg-muted',
          )}
          aria-pressed={published}
          aria-label={published ? `إخفاء ${def.label}` : `إظهار ${def.label}`}
          title="تحكم في نشر هذا الحقل"
        >
          {published
            ? <><Eye size={11} aria-hidden /> ظاهر</>
            : <><EyeOff size={11} aria-hidden /> مخفي</>}
        </button>
      </div>

      <input
        id={`contact-${def.key}`}
        type={def.type}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        placeholder={def.placeholder}
        dir={def.type === 'tel' || def.type === 'email' || def.type === 'url' ? 'ltr' : undefined}
        className="h-9 w-full rounded-md border border-border bg-surface-sunken px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />

      {published && !value && (
        <p className="text-xs text-fg-muted" role="status">
          الحقل ظاهر لكن القيمة فارغة — لن يظهر للزوار حتى تُدخل قيمة.
        </p>
      )}
    </div>
  );
}

export function ContactEditor({ value, onChange }: Props) {
  const set = (key: keyof ContactContent, v: string | boolean) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-3">
      <p className="text-sm text-fg-muted">
        كل حقل لديه مفتاح نشر مستقل — الافتراضي مخفي لحماية خصوصيتك.
        الحقول الظاهرة ستُعرض للزوار بعد النشر.
      </p>
      {FIELDS.map((def) => (
        <ContactField
          key={def.key}
          def={def}
          value={(value?.[def.key] as string) ?? ''}
          published={(value?.[def.publishKey] as boolean) ?? false}
          onValue={(v) => set(def.key, v)}
          onPublished={(v) => set(def.publishKey, v)}
        />
      ))}
    </div>
  );
}
