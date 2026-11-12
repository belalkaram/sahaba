import React from 'react';
import Link from 'next/link';
import { CalendarCheck, CheckCircle2, PlayCircle, ShieldCheck, TrendingUp } from 'lucide-react';
import { HERO } from './content';
import { HeroPattern } from './hero-pattern';
import { buttonClasses } from '../../components/ui/button-styles';
import { Badge } from '../../components/ui/badge';
import { IconNext } from '../../components/icons/directional';

/**
 * Hero: the headline reveals line by line behind a mask, the khatam pattern draws itself, and the
 * preview is built from the product's own primitives (Card surfaces, Badge, progress, KPI tiles)
 * rather than a drawing of a screen. Animation is added by features/landing/landing-motion.tsx.
 */
export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      <HeroPattern />
      <div className="relative mx-auto grid max-w-[var(--content-max)] items-center gap-12 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-16">
        <div className="space-y-6">
          <HeroLine delay={0}>
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-subtle px-3 py-1 text-sm font-semibold text-primary-subtle-fg">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              {HERO.eyebrow}
            </p>
          </HeroLine>

          <h1 className="font-display text-4xl leading-[1.25] text-fg sm:text-5xl lg:text-[3.5rem]">
            <HeroLine className="block" delay={0.06}>
              <span className="block">{HERO.title}</span>
            </HeroLine>
            <HeroLine className="block" delay={0.16}>
              <span className="block text-primary">{HERO.titleAccent}</span>
            </HeroLine>
          </h1>

          <p data-hero-copy style={{ animationDelay: '0.3s' }} className="max-w-xl text-lg leading-relaxed text-fg-muted">
            {HERO.description}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link data-hero-cta data-magnetic style={{ animationDelay: '0.4s' }} href={HERO.primaryCta.href} className={buttonClasses('primary', 'lg', 'group')}>
              {HERO.primaryCta.label}
              <IconNext size={18} className="transition-transform duration-200 group-hover:-translate-x-1" />
            </Link>
            <Link data-hero-cta style={{ animationDelay: '0.46s' }} href={HERO.secondaryCta.href} className={buttonClasses('secondary', 'lg')}>
              {HERO.secondaryCta.label}
            </Link>
          </div>

          <ul data-hero-cta style={{ animationDelay: '0.54s' }} className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-sm text-fg-muted">
            {['بيانات كل أكاديمية في قاعدة مستقلة', 'حضور بالرمز من الجوال', 'تقارير لولي الأمر'].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="shrink-0 text-primary" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

/** Wraps a line so its entrance is clipped: the text slides up from behind its own edge. */
function HeroLine({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <span className={`overflow-hidden pb-[0.12em] ${className}`.trim()} style={{ display: className.includes('block') ? 'block' : 'inline-block' }}>
      <span data-hero-line className="block" style={{ animationDelay: `${delay}s` }}>
        {children}
      </span>
    </span>
  );
}

/** Product preview inside the Gulf arch, assembled from the real design-system surfaces. */
function HeroPreview() {
  return (
    <div data-hero-visual style={{ animationDelay: '0.12s' }} className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="rounded-3xl relative mx-auto aspect-[4/5] w-full max-w-[26rem] overflow-hidden bg-gradient-brand p-5 shadow-xl sm:p-6">
        <span className="pattern-overlay opacity-80 [background-color:rgba(255,255,255,0.12)]" aria-hidden />

        <div className="relative mt-20 space-y-3 rounded-lg border border-border bg-surface p-4 text-fg shadow-lg sm:mt-24">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold">تابع التعلّم</span>
            <Badge variant="brand" size="sm">
              الدرس ٤ من ١٢
            </Badge>
          </div>
          <p className="text-sm text-fg-muted">الرياضيات المتقدمة — النهايات والاتصال</p>
          <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
            <span data-hero-progress className="block h-full w-[38%] rounded-full bg-primary" />
          </div>
          <div className="flex items-center gap-2 pt-1 text-sm font-semibold text-primary">
            <PlayCircle size={18} aria-hidden /> متابعة المشاهدة
          </div>
        </div>

        <div className="relative mt-3 grid grid-cols-2 gap-3">
          <PreviewTile label="الحضور" value="٩٦٪" tone="success" icon={<CalendarCheck size={15} aria-hidden />} />
          <PreviewTile label="المعدل" value="٨٨٫٥" tone="brand" icon={<TrendingUp size={15} aria-hidden />} />
        </div>
      </div>

      <HeroChip
        className="-start-2 top-14 sm:-start-8"
        tone="bg-success-subtle text-success"
        icon={<CalendarCheck size={18} aria-hidden />}
        title="تم تسجيل حضورك"
        subtitle="حصة الفيزياء — ٤:٣٠ م"
        delay="0.55s"
      />
      <HeroChip
        className="-end-2 bottom-20 sm:-end-6"
        tone="bg-accent-subtle text-accent"
        icon={<TrendingUp size={18} aria-hidden />}
        title="درجة جديدة"
        subtitle="اختبار الوحدة الثالثة: ٩٢٪"
        delay="0.68s"
      />
      <div
        data-hero-chip
        style={{ animationDelay: '0.8s' }}
        className="absolute -start-4 bottom-6 hidden items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-fg shadow-md sm:flex"
      >
        <ShieldCheck size={14} className="text-primary" aria-hidden /> بيانات كل أكاديمية معزولة
      </div>
    </div>
  );
}

function PreviewTile({ label, value, tone, icon }: { label: string; value: string; tone: 'success' | 'brand'; icon: React.ReactNode }) {
  const tones = { success: 'bg-success-subtle text-success', brand: 'bg-primary-subtle text-primary' };
  return (
    <div className="rounded-lg border border-border bg-surface p-3 text-fg shadow-md">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-fg-muted">{label}</span>
        <span className={`grid h-6 w-6 place-items-center rounded-md ${tones[tone]}`}>{icon}</span>
      </div>
      <p className="mt-1 text-xl font-bold tabular">{value}</p>
    </div>
  );
}

function HeroChip({ className, tone, icon, title, subtitle, delay }: { className: string; tone: string; icon: React.ReactNode; title: string; subtitle: string; delay: string }) {
  return (
    <div data-hero-chip style={{ animationDelay: delay }} className={`absolute flex items-center gap-2.5 rounded-lg border border-border bg-surface-raised px-3.5 py-2.5 shadow-lg ${className}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${tone}`}>{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="block text-xs text-fg-muted">{subtitle}</span>
      </span>
    </div>
  );
}
