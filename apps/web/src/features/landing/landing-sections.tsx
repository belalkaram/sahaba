'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  ChartColumn,
  ChevronDown,
  Circle,
  ClipboardCheck,
  FileText,
  HeartHandshake,
  PlayCircle,
  QrCode,
  Quote,
  ReceiptText,
  ScanLine,
  Users,
  Video,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { FAQ, ROLE_FEATURES, STEPS, TESTIMONIALS, type RoleKey } from './content';
import { SectionHeading } from './story-sections';
import { Tabs } from '../../components/ui/tabs';
import { buttonClasses } from '../../components/ui/button';
import { IconNext } from '../../components/icons/directional';
import { SampleTag } from './sample-tag';
import { cn } from '../../lib/cn';
import { toArabicDigits } from '../../lib/format';
import { gsap, useGSAP, prefersReducedMotion } from '../../lib/motion';

/** Icons referenced by name in content.ts (explicit map keeps the bundle small). */
const FEATURE_ICONS: Record<string, LucideIcon> = {
  Award,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  ChartColumn,
  ClipboardCheck,
  FileText,
  HeartHandshake,
  PlayCircle,
  QrCode,
  ReceiptText,
  ScanLine,
  Users,
  Video,
  Wallet,
};

/** One experience per role: its features, and the screens that role actually gets. */
export function RoleFeatures() {
  const [role, setRole] = useState<RoleKey>('student');
  const data = ROLE_FEATURES[role];
  const paneRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(paneRef.current?.querySelectorAll('[data-role-item]') ?? [], {
        autoAlpha: 0,
        y: 14,
        duration: 0.45,
        stagger: 0.05,
        ease: 'power3.out',
        clearProps: 'transform,opacity,visibility',
      });
    },
    { dependencies: [role], scope: paneRef },
  );

  return (
    <section id="features" className="scroll-mt-24 py-20 lg:py-28" data-reveal-group>
      <div className="mx-auto max-w-[var(--content-max)] px-4 sm:px-6">
        <SectionHeading
          eyebrow="لكل دور تجربته"
          title="منصة واحدة، أربع تجارب مصمّمة بعناية"
          description="كل مستخدم يرى ما يحتاجه فقط — بلا ازدحام وبلا تعقيد."
        />
        <div className="mb-10 flex justify-center" data-reveal>
          <Tabs
            tabs={(Object.keys(ROLE_FEATURES) as RoleKey[]).map((k) => ({ id: k, label: ROLE_FEATURES[k].label }))}
            activeTab={role}
            onChange={(id) => setRole(id as RoleKey)}
          />
        </div>

        <div ref={paneRef} className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
          <div>
            <h3 className="mb-6 text-xl font-bold text-fg" data-role-item>
              {data.title}
            </h3>
            <div className="grid gap-5 sm:grid-cols-2">
              {data.items.map((item) => {
                const Icon = FEATURE_ICONS[item.icon] ?? Circle;
                return (
                  <article
                    key={item.title}
                    data-role-item
                    className="group rounded-lg border border-border bg-surface p-6 shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
                  >
                    <span className="arch mb-5 grid h-14 w-12 place-items-center bg-primary-subtle text-primary transition-colors group-hover:bg-primary group-hover:text-primary-fg">
                      <Icon size={22} strokeWidth={1.75} aria-hidden />
                    </span>
                    <h4 className="mb-2 text-base font-bold text-fg">{item.title}</h4>
                    <p className="text-sm leading-relaxed text-fg-muted">{item.text}</p>
                  </article>
                );
              })}
            </div>
          </div>

          {/* The actual menu this role sees after signing in. */}
          <aside data-role-item className="rounded-xl border border-border bg-surface-muted/50 p-5">
            <p className="mb-4 text-sm font-bold text-fg">{data.screensTitle}</p>
            <ul className="space-y-1.5">
              {data.screens.map((screen) => (
                <li key={screen} className="flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-sm text-fg-muted shadow-xs">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
                  {screen}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 bg-surface py-20 lg:py-28" data-reveal-group>
      <div className="mx-auto max-w-[var(--content-max)] px-4 sm:px-6">
        <SectionHeading eyebrow="ابدأ خلال يوم واحد" title="ثلاث خطوات وتنطلق أكاديميتك" />
        <ol className="relative grid gap-8 md:grid-cols-3">
          <span className="absolute inset-x-[16%] top-7 hidden h-px bg-border-strong md:block" aria-hidden />
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative text-center" data-reveal>
              <span className="relative mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full border-4 border-surface bg-primary text-xl font-bold text-primary-fg shadow-md">
                {toArabicDigits(i + 1)}
              </span>
              <h3 className="mb-2 text-lg font-bold text-fg">{step.title}</h3>
              <p className="mx-auto max-w-xs text-sm leading-relaxed text-fg-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Testimonials() {
  return (
    <section className="py-20 lg:py-28" data-reveal-group>
      <div className="mx-auto max-w-[var(--content-max)] px-4 sm:px-6">
        <SectionHeading eyebrow="من الميدان" title="ماذا يقول مستخدمو سحابة" />
        <div className="grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="flex flex-col rounded-lg border border-border bg-surface p-6 shadow-sm" data-reveal>
              <Quote size={28} className="mb-4 text-accent" aria-hidden />
              <blockquote className="flex-1 text-base leading-relaxed text-fg">{t.quote}</blockquote>
              <figcaption className="mt-6 border-t border-border-subtle pt-4">
                <span className="block text-sm font-bold text-fg">{t.name}</span>
                <span className="block text-xs text-fg-muted">{t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-6 flex justify-center">
          <SampleTag show={TESTIMONIALS.some((t) => t.sample)} />
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-24 bg-surface py-20 lg:py-28" data-reveal-group>
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading eyebrow="أسئلة شائعة" title="كل ما تودّ معرفته" />
        <div className="divide-y divide-border rounded-lg border border-border" data-reveal>
          {FAQ.map((item, i) => (
            <div key={item.q}>
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                aria-controls={`faq-answer-${i}`}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start text-base font-semibold text-fg transition-colors hover:bg-surface-muted"
              >
                {item.q}
                <ChevronDown size={18} className={cn('shrink-0 text-fg-muted transition-transform duration-200', open === i && 'rotate-180')} aria-hidden />
              </button>
              <div
                id={`faq-answer-${i}`}
                inert={open !== i}
                className={cn('grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none', open === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm leading-relaxed text-fg-muted">{item.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="px-4 py-20 sm:px-6" data-reveal-group>
      <div className="relative mx-auto max-w-[var(--content-max)] overflow-hidden rounded-2xl bg-gradient-brand px-6 py-14 text-center text-white shadow-xl sm:px-12" data-reveal>
        <span className="pattern-overlay [background-color:rgba(255,255,255,0.10)]" aria-hidden />
        <div className="relative mx-auto max-w-2xl space-y-5">
          <h2 className="font-display text-3xl sm:text-4xl">جاهز تنقل أكاديميتك إلى سحابة؟</h2>
          <p className="text-base text-white/75">سجّل مؤسستك الآن، وابدأ بإضافة معلميك وطلابك في دقائق.</p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/register-school" className={buttonClasses('secondary', 'lg', 'border-transparent bg-white text-[var(--emerald-800)] hover:bg-white/90')}>
              سجّل أكاديميتك
              <IconNext size={18} />
            </Link>
            <Link href="/contact" className={buttonClasses('ghost', 'lg', 'text-white hover:bg-white/10 hover:text-white')}>
              تحدّث مع فريقنا
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
