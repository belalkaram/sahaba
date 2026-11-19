'use client';

/**
 * Horizon hero — 'plain': no band, no gradient. Generous whitespace, light type, a single
 * hairline and the numbers as a quiet inline row. Content first.
 */
import React from 'react';
import { IconNext } from '../../../../components/icons/directional';
import { HeroLogo, HeroMeta, JoinNote, Link, heroLinks, statItems, statValue } from '../hero-parts';
import type { HeroProps } from '../hero-parts';

export function HorizonHero({ academy, stats, showStats }: HeroProps) {
  const links = heroLinks(academy);
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-8 sm:py-28">
        <HeroLogo academy={academy} className="mb-8 h-14 w-14 rounded-sm" />
        <HeroMeta academy={academy} className="text-fg-subtle" />
        <h1 className="mt-4 break-words font-display text-4xl font-light leading-tight text-fg sm:text-6xl">{academy.name}</h1>
        {academy.brand_tagline && <p className="mt-5 max-w-2xl text-xl font-light leading-relaxed text-fg-muted">{academy.brand_tagline}</p>}

        <hr className="my-10 w-16 border-t border-primary" />

        {showStats && (
          <dl className="mb-10 flex flex-wrap gap-x-10 gap-y-3 text-fg-muted">
            {statItems(stats).map((s) => (
              <div key={s.label} className="flex items-baseline gap-2">
                <dt className="text-sm">{s.label}</dt>
                <dd className="order-first font-display text-2xl font-light text-fg tabular">{statValue(s.value)}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Link href={links.courses} className="inline-flex items-center gap-2 border-b-2 border-primary pb-1 font-semibold text-primary">
            تصفّح المقررات
            <IconNext size={16} />
          </Link>
          <Link href={links.join.href} className="text-fg-muted underline-offset-4 hover:text-fg hover:underline">
            {links.join.label}
          </Link>
        </div>
        <JoinNote academy={academy} className="mt-4 text-fg-subtle" />
      </div>
    </section>
  );
}
