import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Circle, Ticket, UserCheck, type LucideIcon } from 'lucide-react';
import type { PublicPricing } from '../../lib/public-api';
import { PRICING_POINTS } from './content';
import { SectionHeading } from './story-sections';
import { buttonClasses } from '../../components/ui/button-styles';
import { IconNext } from '../../components/icons/directional';

const ICONS: Record<string, LucideIcon> = { UserCheck, Ticket, ArrowUpRight };

/**
 * How paying works (OD-39): the academy buys seat capacity, the student pays the platform nothing.
 * The headline comes from the API so it always matches what the platform actually charges.
 */
export function PricingSection({ pricing }: { pricing: PublicPricing | null }) {
  return (
    <section id="pricing" className="scroll-mt-24 py-20 lg:py-28" data-reveal-group>
      <div className="mx-auto max-w-[var(--content-max)] px-4 sm:px-6">
        <SectionHeading
          eyebrow="الاشتراك"
          title="تدفع الأكاديمية على السعة، لا على كل عملية"
          description={pricing?.headline ?? 'الطالب لا يدفع للمنصة شيئاً. الأكاديمية أو المدرس المستقل يشتري سعة المقاعد التي يحتاجها.'}
        />

        <div className="grid gap-5 md:grid-cols-3">
          {PRICING_POINTS.map((point) => {
            const Icon = ICONS[point.icon] ?? Circle;
            return (
              <article key={point.title} className="rounded-xl border border-border bg-surface p-6 shadow-xs" data-reveal>
                <span className="arch mb-5 grid h-14 w-12 place-items-center bg-primary-subtle text-primary">
                  <Icon size={22} strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="mb-2 text-base font-bold text-fg">{point.title}</h3>
                <p className="text-sm leading-relaxed text-fg-muted">{point.text}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-xl border border-border bg-surface-muted/60 p-6 sm:flex-row" data-reveal>
          <ul className="grid gap-2 text-sm text-fg-muted sm:grid-cols-2">
            {['بلا رسوم إعداد', 'بلا عقد سنوي ملزم', 'الدعم بالعربية', 'تبدأ بسعة صغيرة وتكبر'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check size={15} className="shrink-0 text-success" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <Link href="/pricing" className={buttonClasses('secondary', 'lg', 'shrink-0')}>
            تفاصيل الأسعار
            <IconNext size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
