'use client';

/**
 * Atlas hero — 'grid-stats': two columns on a hex-lattice brand band; identity and actions on
 * one side, the numbers as an outlined tile grid on the other. Small radius, organised.
 */
import React from 'react';
import { IconNext } from '../../../../components/icons/directional';
import { HeroLogo, HeroMeta, JoinNote, Link, heroLinks, statItems, statValue } from '../hero-parts';
import type { HeroProps } from '../hero-parts';

const HEX =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='84' viewBox='0 0 48 84'%3E%3Cg fill='none' stroke='white' stroke-opacity='.14'%3E%3Cpath d='M24 0l24 14v28L24 56 0 42V14z'/%3E%3Cpath d='M24 56l24 14v28M24 56L0 70v28'/%3E%3C/g%3E%3C/svg%3E\")";

export function AtlasHero({ academy, stats, showStats }: HeroProps) {
  const links = heroLinks(academy);
  const items = statItems(stats);
  return (
    <section className="relative bg-gradient-brand text-white">
      <span className="absolute inset-0" style={{ backgroundImage: HEX }} aria-hidden />
      <div className={`relative mx-auto grid max-w-[var(--content-max)] gap-10 px-4 py-14 sm:px-6 lg:py-16 ${showStats ? 'lg:grid-cols-2 lg:items-center' : ''}`}>
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <HeroLogo academy={academy} className="h-16 w-16 rounded-sm border border-white/40 bg-white p-2" />
            <HeroMeta academy={academy} className="text-white/80" chipClassName="rounded-sm border border-white/40 px-2 py-0.5" />
          </div>
          <h1 className="break-words font-display text-4xl leading-tight sm:text-5xl">{academy.name}</h1>
          {academy.brand_tagline && <p className="max-w-xl text-lg text-white/80">{academy.brand_tagline}</p>}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href={links.courses} className="inline-flex h-11 items-center gap-2 rounded-sm bg-white px-6 font-semibold text-primary transition-colors hover:bg-white/90">
              تصفّح المقررات
              <IconNext size={18} />
            </Link>
            <Link href={links.join.href} className="inline-flex h-11 items-center rounded-sm border border-white/50 px-6 font-semibold text-white transition-colors hover:bg-white/10">
              {links.join.label}
            </Link>
          </div>
          <JoinNote academy={academy} className="text-white/70" />
        </div>

        {showStats && (
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-white/30 bg-white/30">
            {items.map((s) => (
              <div key={s.label} className="flex flex-col bg-black/15 p-6 backdrop-blur-sm">
                <dt className="mt-2 text-sm text-white/75">{s.label}</dt>
                <dd className="order-first font-display text-4xl tabular">{statValue(s.value)}</dd>
              </div>
            ))}
            {items.length % 2 === 1 && (
              <div className="flex items-end bg-black/15 p-6 text-sm text-white/75 backdrop-blur-sm">
                {academy.city ?? 'تعليم منظّم'}
              </div>
            )}
          </dl>
        )}
      </div>
    </section>
  );
}
