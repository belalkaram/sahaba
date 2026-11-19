'use client';

/**
 * Beacon hero — 'editorial': start-aligned headline on the page surface, an accent rule, sharp
 * corners and a solid brand block carrying numbered stats like a magazine index.
 */
import React from 'react';
import { IconNext } from '../../../../components/icons/directional';
import { HeroLogo, HeroMeta, JoinNote, Link, heroLinks, statItems, statValue } from '../hero-parts';
import type { HeroProps } from '../hero-parts';

export function BeaconHero({ academy, stats, showStats }: HeroProps) {
  const links = heroLinks(academy);
  return (
    <section className="border-b-4 border-fg bg-surface">
      <div className="mx-auto grid max-w-[var(--content-max)] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:py-20">
        <div className="flex flex-col justify-center gap-6">
          <span className="h-1.5 w-20 bg-accent" aria-hidden />
          <HeroMeta academy={academy} className="font-semibold uppercase tracking-wide text-fg-muted" />
          <h1 className="break-words font-display text-5xl font-black leading-[1.05] text-fg sm:text-6xl">{academy.name}</h1>
          {academy.brand_tagline && (
            <p className="max-w-xl border-s-4 border-primary ps-4 text-xl leading-relaxed text-fg-muted">{academy.brand_tagline}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href={links.courses} className="inline-flex h-12 items-center gap-2 bg-primary px-7 font-bold text-primary-fg transition-colors hover:bg-primary-hover">
              تصفّح المقررات
              <IconNext size={18} />
            </Link>
            <Link href={links.join.href} className="inline-flex h-12 items-center border-2 border-fg px-7 font-bold text-fg transition-colors hover:bg-fg hover:text-surface">
              {links.join.label}
            </Link>
          </div>
          <JoinNote academy={academy} className="text-fg-subtle" />
        </div>

        <div className="relative flex flex-col justify-between gap-8 bg-gradient-brand p-8 text-white">
          <span className="absolute -end-3 -top-3 h-16 w-16 bg-accent" aria-hidden />
          <HeroLogo academy={academy} className="relative h-16 w-16 bg-white p-2" />
          {showStats ? (
            <dl className="relative divide-y divide-white/25">
              {statItems(stats).map((s, i) => (
                <div key={s.label} className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="flex items-baseline gap-3 text-sm text-white/80">
                    <span className="font-mono text-xs text-white/60">{String(i + 1).padStart(2, '0')}</span>
                    {s.label}
                  </dt>
                  <dd className="font-display text-4xl font-black tabular">{statValue(s.value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="relative font-display text-3xl font-black leading-tight">{academy.name}</p>
          )}
        </div>
      </div>
    </section>
  );
}
