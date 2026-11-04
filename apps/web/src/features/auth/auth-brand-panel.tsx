'use client';

import React, { useRef } from 'react';
import { CalendarCheck, PlayCircle, ShieldCheck } from 'lucide-react';
import { BRAND } from '../../config/brand';
import { gsap, useGSAP, prefersReducedMotion } from '../../lib/motion';

const POINTS = [
  { icon: PlayCircle, title: 'دروس وحصص مباشرة', text: 'محتوى مسجّل وحصص حيّة في مكان واحد.' },
  { icon: CalendarCheck, title: 'حضور ذكي بالرمز', text: 'تسجيل حضور فوري ومتابعة لحظية لكل شعبة.' },
  { icon: ShieldCheck, title: 'صلاحيات آمنة', text: 'كل دور يرى ما يخصّه فقط، وبيانات كل أكاديمية معزولة.' },
];

/** Brand side of the auth screens: emerald gradient, khatam pattern, arch composition. */
export function AuthBrandPanel() {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('[data-arch]', { scale: 0.92, autoAlpha: 0, duration: 0.8, stagger: 0.12 })
        .from('[data-point]', { autoAlpha: 0, y: 16, duration: 0.5, stagger: 0.1 }, '-=0.4');
      gsap.to('[data-float]', { y: -10, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="relative hidden overflow-hidden bg-gradient-brand text-white lg:flex lg:flex-col lg:justify-between">
      <span className="pattern-overlay opacity-60 [background-color:rgba(255,255,255,0.09)]" aria-hidden />

      {/* Arch composition */}
      <div className="relative flex flex-1 items-end justify-center gap-4 px-12 pt-16" aria-hidden>
        <div data-arch className="arch h-44 w-28 border border-white/15 bg-white/5" />
        <div data-arch data-float className="arch relative h-72 w-44 overflow-hidden border border-white/20 bg-white/10 backdrop-blur-sm">
          <span className="pattern-overlay opacity-80 [background-color:rgba(255,255,255,0.18)]" />
          <svg viewBox="0 0 48 48" className="absolute inset-x-0 top-14 mx-auto h-20 w-20" aria-hidden>
            <g fill="#fff">
              <circle cx="16.5" cy="27" r="6.5" />
              <circle cx="25" cy="21.5" r="8.5" />
              <circle cx="33.5" cy="27.5" r="6" />
              <rect x="16.5" y="26" width="17" height="7.5" />
            </g>
            <path d="M22 33.5V28.5a3 3 0 0 1 6 0v5z" fill="#0C7F6D" />
          </svg>
        </div>
        <div data-arch className="arch h-52 w-32 border border-white/15 bg-white/5" />
      </div>

      <div className="relative space-y-8 px-12 pb-14 pt-10">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[var(--sand-200)]">{BRAND.nameEn}</p>
          <h2 className="font-display text-4xl leading-tight">
            تعليمٌ أقرب،
            <br />
            وإدارةٌ أسهل.
          </h2>
          <p className="max-w-md text-base text-white/75">{BRAND.descriptionAr}</p>
        </div>
        <ul className="grid gap-4">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <li key={title} data-point className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/10 ring-1 ring-white/15">
                <Icon size={20} strokeWidth={1.75} aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-sm text-white/70">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="sadu relative w-full opacity-60" aria-hidden />
    </div>
  );
}
