'use client';

/**
 * TL-6 (ADR-007, OD-43): Owner-written content sections of the public academy page.
 * Each renders nothing when it has no content, so an enabled-but-empty section never shows a shell.
 * Contact fields arrive already filtered by the API (only fields the owner opted to publish).
 */
import React from 'react';
import { Check, Mail, MapPin, Phone, MessageCircle, Map as MapIcon } from 'lucide-react';
import type { TenantLandingPublic } from '../../../lib/public-api';
import { SectionTitle } from '../../public-academy/list-sections';

type Content = NonNullable<TenantLandingPublic['content']>;

export function AboutSection({ name, about }: { name: string; about: Content['about'] }) {
  const text = about?.text?.trim();
  const highlights = (about?.highlights ?? []).filter((h) => h.trim());
  if (!text && highlights.length === 0) return null;
  return (
    <section>
      <SectionTitle title={`عن ${name}`} />
      <div className="tl-panel rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        {text && <p className="whitespace-pre-line leading-relaxed text-fg">{text}</p>}
        {highlights.length > 0 && (
          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {highlights.map((h, i) => (
              <li key={i} className="tl-chip flex items-start gap-2 rounded-lg bg-primary-subtle px-3 py-2 text-sm text-primary-subtle-fg">
                <Check size={16} aria-hidden className="mt-0.5 shrink-0" />
                {h}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function FaqSection({ faq }: { faq: Content['faq'] }) {
  const items = (faq ?? []).filter((f) => f.question.trim() && f.answer.trim());
  if (items.length === 0) return null;
  return (
    <section>
      <SectionTitle title="الأسئلة الشائعة" />
      <div className="tl-panel divide-y divide-border rounded-2xl border border-border bg-surface shadow-sm">
        {items.map((f, i) => (
          <details key={i} className="group px-5 py-4">
            <summary className="cursor-pointer list-none font-semibold text-fg marker:hidden">
              {f.question}
            </summary>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-fg-muted">{f.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function ContactSection({ contact }: { contact: Content['contact'] }) {
  if (!contact) return null;
  const rows: Array<{ icon: React.ReactNode; label: string; value: string; href?: string }> = [];
  if (contact.phone) rows.push({ icon: <Phone size={16} aria-hidden />, label: 'الهاتف', value: contact.phone, href: `tel:${contact.phone}` });
  if (contact.whatsapp) rows.push({ icon: <MessageCircle size={16} aria-hidden />, label: 'واتساب', value: contact.whatsapp, href: `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}` });
  if (contact.email) rows.push({ icon: <Mail size={16} aria-hidden />, label: 'البريد', value: contact.email, href: `mailto:${contact.email}` });
  if (contact.address) rows.push({ icon: <MapPin size={16} aria-hidden />, label: 'العنوان', value: contact.address });
  if (contact.map_url && /^https:\/\//.test(contact.map_url)) rows.push({ icon: <MapIcon size={16} aria-hidden />, label: 'الخريطة', value: 'افتح الموقع على الخريطة', href: contact.map_url });
  if (rows.length === 0) return null;
  return (
    <section>
      <SectionTitle title="تواصل معنا" />
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.label} className="tl-card flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
            <span className="tl-icon grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary-subtle-fg">{r.icon}</span>
            <span className="min-w-0">
              <span className="block text-xs text-fg-muted">{r.label}</span>
              {r.href ? (
                <a href={r.href} target={r.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="block truncate font-medium text-fg hover:text-primary" dir="auto">
                  {r.value}
                </a>
              ) : (
                <span className="block break-words font-medium text-fg">{r.value}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
