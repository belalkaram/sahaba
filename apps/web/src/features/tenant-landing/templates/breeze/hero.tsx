'use client';

/**
 * Breeze hero — 'soft-cards': light airy band with soft colour blobs, round logo, pill buttons
 * and the stats as floating rounded cards.
 */
import React from 'react';
import { IconNext } from '../../../../components/icons/directional';
import { HeroLogo, HeroMeta, JoinNote, Link, heroLinks, statItems, statValue } from '../hero-parts';
import type { HeroProps } from '../hero-parts';

export function BreezeHero({ academy, stats, showStats }: HeroProps) {
  const links = heroLinks(academy);
  return (
    <section className="relative overflow-hidden bg-primary-subtle/60">
      <span className="absolute -start-24 -top-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" aria-hidden />
      <span className="absolute -bottom-32 end-0 h-96 w-96 rounded-full bg-accent/20 blur-3xl" aria-hidden />
      <span className="absolute end-1/4 top-10 h-24 w-24 rounded-full bg-accent-subtle" aria-hidden />
      <div className="relative mx-auto max-w-[var(--content-max)] px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex flex-col items-center gap-6 text-center">
          {academy.logo_url && (
            <span className="grid h-24 w-24 place-items-center rounded-full bg-surface p-3 shadow-lg ring-8 ring-surface/60">
              <HeroLogo academy={academy} className="h-16 w-16 rounded-full" />
            </span>
          )}
          <HeroMeta academy={academy} className="justify-center text-fg-muted" chipClassName="rounded-full bg-surface px-3 py-1 text-primary shadow-xs" />
          <h1 className="mx-auto max-w-3xl break-words font-display text-4xl leading-tight text-fg sm:text-5xl">{academy.name}</h1>
          {academy.brand_tagline && <p className="mx-auto max-w-2xl text-lg text-fg-muted">{academy.brand_tagline}</p>}

          {showStats && (
            <dl className="flex flex-wrap justify-center gap-4">
              {statItems(stats).map((s, i) => (
                <div
                  key={s.label}
                  className={`flex min-w-32 flex-col rounded-3xl bg-surface/80 px-6 py-4 shadow-md backdrop-blur ${i % 2 ? 'sm:translate-y-3' : ''}`}
                >
                  <dt className="mt-1 text-sm text-fg-muted">{s.label}</dt>
                  <dd className="order-first font-display text-3xl text-primary tabular">{statValue(s.value)}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link href={links.courses} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 font-semibold text-primary-fg shadow-md transition-transform hover:-translate-y-0.5">
              تصفّح المقررات
              <IconNext size={18} />
            </Link>
            <Link href={links.join.href} className="inline-flex h-12 items-center rounded-full bg-surface px-7 font-semibold text-primary shadow-xs transition-transform hover:-translate-y-0.5">
              {links.join.label}
            </Link>
          </div>
          <JoinNote academy={academy} className="text-fg-subtle" />
        </div>
      </div>
    </section>
  );
}
