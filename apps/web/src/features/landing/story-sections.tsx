import React from 'react';
import {
  BellRing,
  Building2,
  CalendarClock,
  ChartColumn,
  Circle,
  ClipboardList,
  Database,
  FileCheck2,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  KeyRound,
  MessagesSquare,
  MonitorPlay,
  PlayCircle,
  QrCode,
  ScrollText,
  ShieldCheck,
  Table,
  TriangleAlert,
  UserCog,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { ANALYTICS, PROBLEM, SECURITY, SERVICES, SOLUTION } from './content';
import { IconNext } from '../../components/icons/directional';
import { formatPercent } from '../../lib/format';

const ICONS: Record<string, LucideIcon> = {
  BellRing,
  Building2,
  CalendarClock,
  ChartColumn,
  ClipboardList,
  Database,
  FileCheck2,
  FileText,
  FolderOpen,
  ImageIcon,
  KeyRound,
  MessagesSquare,
  MonitorPlay,
  PlayCircle,
  QrCode,
  ScrollText,
  ShieldCheck,
  Table,
  TriangleAlert,
  UserCog,
  Video,
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const Cmp = ICONS[name] ?? Circle;
  return <Cmp size={size} strokeWidth={1.75} aria-hidden />;
}

export function SectionHeading({ eyebrow, title, description, align = 'center' }: { eyebrow?: string; title: string; description?: string; align?: 'center' | 'start' }) {
  return (
    <div className={`mb-12 max-w-2xl space-y-3 ${align === 'center' ? 'mx-auto text-center' : 'text-start'}`} data-reveal>
      {eyebrow && <p className="text-sm font-semibold text-primary">{eyebrow}</p>}
      <h2 className="font-display text-3xl text-fg sm:text-4xl">{title}</h2>
      {description && <p className="text-base leading-relaxed text-fg-muted">{description}</p>}
    </div>
  );
}

/**
 * The problem and what replaces it, side by side. The scattered tools drift toward the single
 * panel as the section scrolls (landing-motion.tsx); without that they simply sit there, so the
 * comparison reads on its own.
 */
export function ProblemSolution() {
  return (
    <section id="why" className="scroll-mt-24 py-20 lg:py-28" data-reveal-group>
      <div className="mx-auto max-w-[var(--content-max)] px-4 sm:px-6">
        <SectionHeading eyebrow={PROBLEM.eyebrow} title={PROBLEM.title} description={PROBLEM.description} />

        <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
          <ul className="grid gap-3" data-reveal>
            {PROBLEM.pains.map((pain, i) => (
              <li
                key={pain.text}
                data-converge
                style={{ ['--converge-x' as string]: `${(i % 2 === 0 ? -1 : 1) * (10 + i * 4)}px` }}
                className="flex items-center gap-3 rounded-lg border border-dashed border-border-strong bg-surface-muted/60 px-4 py-3 text-sm text-fg-muted"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface text-fg-subtle">
                  <Icon name={pain.icon} size={18} />
                </span>
                {pain.text}
              </li>
            ))}
          </ul>

          <div className="mx-auto hidden h-12 w-12 place-items-center rounded-full border border-border bg-surface text-primary shadow-sm lg:grid" aria-hidden>
            <IconNext size={22} />
          </div>

          <div data-converge-target className="relative overflow-hidden rounded-2xl bg-gradient-brand p-6 text-surface-brand-fg shadow-xl sm:p-8" data-reveal>
            <span className="pattern-overlay opacity-60 [background-color:rgba(255,255,255,0.12)]" aria-hidden />
            <div className="relative space-y-5">
              <h3 className="font-display text-2xl sm:text-3xl">{SOLUTION.title}</h3>
              <ul className="space-y-3">
                {SOLUTION.points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm leading-relaxed text-surface-brand-fg/90">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-surface-brand-fg/70" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** OD-31: the two services an academy can take, together or on their own. */
export function Services() {
  return (
    <section id="services" className="scroll-mt-24 bg-surface py-20 lg:py-28" data-reveal-group>
      <div className="mx-auto max-w-[var(--content-max)] px-4 sm:px-6">
        <SectionHeading
          eyebrow="خدمتان، تختار ما يناسبك"
          title="أونلاين، حضوري، أو الاثنان معاً"
          description="تفعّل الأكاديمية ما تحتاجه فقط، وتتغيّر الشاشات والصلاحيات تبعاً لذلك — بلا أقسام فارغة في القائمة."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {SERVICES.map((service) => (
            <article key={service.key} className="flex flex-col rounded-2xl border border-border bg-surface-sunken p-6 shadow-sm sm:p-8" data-reveal>
              <div className="mb-6 flex items-center gap-3">
                <span className="arch grid h-14 w-12 place-items-center bg-primary-subtle text-primary">
                  <Icon name={service.icon} size={24} />
                </span>
                <div>
                  <h3 className="font-display text-2xl text-fg">{service.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-fg-muted">{service.description}</p>
                </div>
              </div>
              <ul className="grid flex-1 gap-4 sm:grid-cols-2">
                {service.items.map((item) => (
                  <li key={item.title} className="rounded-lg border border-border-subtle bg-surface p-4">
                    <span className="mb-2 inline-grid h-9 w-9 place-items-center rounded-md bg-surface-muted text-primary">
                      <Icon name={item.icon} size={18} />
                    </span>
                    <h4 className="mb-1 text-sm font-bold text-fg">{item.title}</h4>
                    <p className="text-xs leading-relaxed text-fg-muted">{item.text}</p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Tenant isolation, drawn: three academies, three databases, one platform. */
export function Security() {
  return (
    <section id="security" className="scroll-mt-24 py-20 lg:py-28" data-reveal-group>
      <div className="mx-auto grid max-w-[var(--content-max)] items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <SectionHeading eyebrow={SECURITY.eyebrow} title={SECURITY.title} description={SECURITY.description} align="start" />
          <ul className="grid gap-4 sm:grid-cols-2">
            {SECURITY.points.map((point) => (
              <li key={point.title} className="rounded-lg border border-border bg-surface p-5 shadow-xs" data-reveal>
                <span className="mb-3 inline-grid h-10 w-10 place-items-center rounded-md bg-primary-subtle text-primary">
                  <Icon name={point.icon} />
                </span>
                <h3 className="mb-1 text-sm font-bold text-fg">{point.title}</h3>
                <p className="text-xs leading-relaxed text-fg-muted">{point.text}</p>
              </li>
            ))}
          </ul>
        </div>
        <IsolationDiagram />
      </div>
    </section>
  );
}

function IsolationDiagram() {
  const academies = [
    { label: 'أكاديمية أ', y: 40 },
    { label: 'أكاديمية ب', y: 140 },
    { label: 'أكاديمية ج', y: 240 },
  ];

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm" data-reveal>
      <svg viewBox="0 0 420 300" className="h-auto w-full" role="img" aria-label="رسم توضيحي: لكل أكاديمية قاعدة بيانات مستقلة تتصل بالمنصة">
        <g className="text-border-strong" stroke="currentColor" strokeWidth="1.5" fill="none">
          {academies.map((a) => (
            <path key={a.label} data-draw d={`M300 ${a.y + 26} H 210 Q 190 ${a.y + 26} 190 150 H 130`} strokeDasharray="4 6" />
          ))}
        </g>
        {academies.map((a) => (
          <g key={a.label}>
            <rect x="300" y={a.y} width="110" height="52" rx="10" className="fill-surface-muted stroke-border" strokeWidth="1.5" />
            <text x="355" y={a.y + 31} textAnchor="middle" className="fill-fg" fontSize={13}>
              {a.label}
            </text>
          </g>
        ))}
        <rect x="10" y="110" width="120" height="80" rx="14" className="fill-primary-subtle stroke-primary" strokeWidth="1.5" />
        <text x="70" y="145" textAnchor="middle" className="fill-primary-subtle-fg font-bold" fontSize={13}>
          سحابة
        </text>
        <text x="70" y="166" textAnchor="middle" className="fill-fg-muted" fontSize={11}>
          المنصة
        </text>
        {academies.map((a) => (
          <g key={`db-${a.label}`}>
            <ellipse cx="248" cy={a.y + 18} rx="22" ry="7" className="fill-surface stroke-border-strong" strokeWidth="1.3" />
            <path d={`M226 ${a.y + 18} v16 a22 7 0 0 0 44 0 v-16`} className="fill-surface stroke-border-strong" strokeWidth="1.3" />
          </g>
        ))}
      </svg>
      <p className="mt-4 text-center text-xs text-fg-muted">لكل أكاديمية قاعدة بياناتها — لا جدول مشترك بين المؤسسات.</p>
    </div>
  );
}

/** Metrics with their source named, and bars that grow when the section appears. */
export function Analytics() {
  return (
    <section id="analytics" className="scroll-mt-24 bg-surface py-20 lg:py-28" data-reveal-group>
      <div className="mx-auto max-w-[var(--content-max)] px-4 sm:px-6">
        <SectionHeading eyebrow={ANALYTICS.eyebrow} title={ANALYTICS.title} description={ANALYTICS.description} />

        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="space-y-6 rounded-2xl border border-border bg-surface-sunken p-6 shadow-sm sm:p-8" data-reveal>
            {ANALYTICS.metrics.map((metric) => (
              <div key={metric.label}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-fg">{metric.label}</span>
                  <span className="font-display text-xl text-primary tabular">{formatPercent(metric.value)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted">
                  <span
                    data-bar
                    style={{ width: `${metric.value}%` }}
                    className="block h-full rounded-full bg-gradient-brand"
                  />
                </div>
                <p className="mt-1.5 text-xs text-fg-subtle">{metric.hint}</p>
              </div>
            ))}
            <p className="border-t border-border-subtle pt-4 text-xs text-fg-muted">
              الأرقام أعلاه توضيحية لشكل اللوحة. داخل المنصة تُحسب من بيانات أكاديميتك وحدها.
            </p>
          </div>

          <ul className="grid gap-4">
            {ANALYTICS.features.map((feature) => (
              <li key={feature.title} className="flex gap-4 rounded-lg border border-border bg-surface p-5 shadow-xs" data-reveal>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-accent-subtle text-accent">
                  <Icon name={feature.icon} />
                </span>
                <div>
                  <h3 className="mb-1 text-sm font-bold text-fg">{feature.title}</h3>
                  <p className="text-xs leading-relaxed text-fg-muted">{feature.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
