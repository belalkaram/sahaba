'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { CalendarCheck, CheckCircle2, PlayCircle, TrendingUp } from 'lucide-react';
import { HERO, STATS } from './content';
import { buttonClasses } from '../../components/ui/button';
import { IconNext } from '../../components/icons/directional';
import { SampleTag } from './sample-tag';
import { gsap, useGSAP, prefersReducedMotion } from '../../lib/motion';

/** Hero: display headline, CTAs, and a product preview inside a Gulf arch frame. */
export function LandingHero() {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('[data-hero-line]', { autoAlpha: 0, y: 24, duration: 0.7, stagger: 0.12 })
        .from('[data-hero-cta]', { autoAlpha: 0, y: 12, duration: 0.5, stagger: 0.08 }, '-=0.35')
        .from('[data-hero-visual]', { autoAlpha: 0, scale: 0.94, duration: 0.9 }, 0.15)
        .from('[data-hero-chip]', { autoAlpha: 0, y: 16, duration: 0.5, stagger: 0.12 }, '-=0.4');
      gsap.to('[data-hero-chip]', { y: -8, duration: 2.8, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 0.6, delay: 1.4 });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative overflow-hidden">
      <span className="pattern-overlay [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" aria-hidden />
      <div className="relative mx-auto grid max-w-[var(--content-max)] items-center gap-12 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-16">
        <div className="space-y-6">
          <p data-hero-line className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-subtle px-3 py-1 text-sm font-semibold text-primary-subtle-fg">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            {HERO.eyebrow}
          </p>
          <h1 className="font-display text-4xl leading-[1.25] text-fg sm:text-5xl lg:text-[3.5rem]">
            <span data-hero-line className="block">
              {HERO.title}
            </span>
            <span data-hero-line className="block text-primary">
              {HERO.titleAccent}
            </span>
          </h1>
          <p data-hero-line className="max-w-xl text-lg leading-relaxed text-fg-muted">
            {HERO.description}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link data-hero-cta href={HERO.primaryCta.href} className={buttonClasses('primary', 'lg', 'group')}>
              {HERO.primaryCta.label}
              <IconNext size={18} className="transition-transform duration-200 group-hover:-translate-x-1" />
            </Link>
            <Link data-hero-cta href={HERO.secondaryCta.href} className={buttonClasses('secondary', 'lg')}>
              {HERO.secondaryCta.label}
            </Link>
          </div>
          <dl data-hero-line className="grid max-w-xl grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-6 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label}>
                <dt className="text-xs text-fg-muted">{s.label}</dt>
                <dd className="mt-1 text-xl font-bold text-fg">{s.value}</dd>
              </div>
            ))}
          </dl>
          <SampleTag show={STATS.some((s) => s.sample)} />
        </div>

        {/* Product preview in an arch */}
        <div data-hero-visual className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="arch relative mx-auto aspect-[4/5] w-full max-w-[26rem] overflow-hidden bg-gradient-brand p-6 shadow-xl">
            <span className="pattern-overlay opacity-80 [background-color:rgba(255,255,255,0.12)]" aria-hidden />
            <div className="relative mt-24 space-y-3 rounded-lg bg-surface p-4 text-fg shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">تابع التعلّم</span>
                <span className="text-xs text-fg-muted">الدرس ٤ من ١٢</span>
              </div>
              <p className="text-sm text-fg-muted">الرياضيات المتقدمة — النهايات والاتصال</p>
              <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full w-[38%] rounded-full bg-primary" />
              </div>
              <div className="flex items-center gap-2 pt-1 text-sm font-semibold text-primary">
                <PlayCircle size={18} aria-hidden /> متابعة المشاهدة
              </div>
            </div>
            <div className="relative mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-surface/95 p-3 text-fg shadow-md">
                <span className="text-xs text-fg-muted">الحضور</span>
                <p className="text-xl font-bold">٩٦٪</p>
              </div>
              <div className="rounded-lg bg-surface/95 p-3 text-fg shadow-md">
                <span className="text-xs text-fg-muted">المعدل</span>
                <p className="text-xl font-bold">٨٨٫٥</p>
              </div>
            </div>
          </div>

          <div data-hero-chip className="absolute -start-2 top-16 flex items-center gap-2.5 rounded-lg border border-border bg-surface-raised px-3.5 py-2.5 shadow-lg sm:-start-8">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-success-subtle text-success">
              <CalendarCheck size={18} aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold text-fg">تم تسجيل حضورك</span>
              <span className="block text-xs text-fg-muted">حصة الفيزياء — ٤:٣٠ م</span>
            </span>
          </div>
          <div data-hero-chip className="absolute -end-2 bottom-20 flex items-center gap-2.5 rounded-lg border border-border bg-surface-raised px-3.5 py-2.5 shadow-lg sm:-end-6">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-accent-subtle text-accent">
              <TrendingUp size={18} aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold text-fg">درجة جديدة</span>
              <span className="block text-xs text-fg-muted">اختبار الوحدة الثالثة: ٩٢٪</span>
            </span>
          </div>
          <div data-hero-chip className="absolute -start-4 bottom-6 hidden items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-fg shadow-md sm:flex">
            <CheckCircle2 size={14} className="text-primary" aria-hidden /> بيانات كل أكاديمية معزولة
          </div>
        </div>
      </div>
    </section>
  );
}
