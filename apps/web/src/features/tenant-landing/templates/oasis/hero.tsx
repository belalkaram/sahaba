'use client';

/**
 * Oasis hero — 'arch-visual': centred, deep brand gradient with the khatam lattice, the logo
 * framed in a Gulf arch, and an arch silhouette closing the band.
 */
import React from 'react';
import { buttonClasses } from '../../../../components/ui/button-styles';
import { IconNext } from '../../../../components/icons/directional';
import { HeroLogo, HeroMeta, JoinNote, Link, heroLinks, statItems, statValue } from '../hero-parts';
import type { HeroProps } from '../hero-parts';

export function OasisHero({ academy, stats, showStats }: HeroProps) {
  const links = heroLinks(academy);
  return (
    <section className="relative overflow-hidden bg-gradient-brand text-white">
      <span className="pattern-overlay opacity-50 [background-color:rgba(255,255,255,0.1)]" aria-hidden />
      <div className="relative mx-auto max-w-[var(--content-max)] px-4 pb-24 pt-14 sm:px-6 sm:pb-28 sm:pt-20">
        <div className="flex flex-col items-center gap-6 text-center">
          {academy.logo_url && (
            <span className="arch grid h-28 w-24 place-items-center border border-white/30 bg-white/95 p-3 shadow-lg">
              <HeroLogo academy={academy} className="h-16 w-16" />
            </span>
          )}
          <div className="space-y-3">
            <HeroMeta academy={academy} className="justify-center text-white/80" chipClassName="rounded-full bg-white/15 px-3 py-1" />
            <h1 className="mx-auto max-w-3xl break-words font-display text-4xl leading-tight sm:text-5xl">{academy.name}</h1>
            {academy.brand_tagline && <p className="mx-auto max-w-2xl text-lg text-white/80">{academy.brand_tagline}</p>}
          </div>

          {showStats && (
            <dl className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-y border-white/20 py-4">
              {statItems(stats).map((s) => (
                <div key={s.label} className="text-center">
                  <dt className="text-xs text-white/70">{s.label}</dt>
                  <dd className="mt-1 font-display text-2xl tabular">{statValue(s.value)}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="flex flex-wrap justify-center gap-3">
            <Link href={links.courses} className={buttonClasses('secondary', 'lg', 'border-transparent bg-white text-primary hover:bg-white/90')}>
              تصفّح المقررات
              <IconNext size={18} />
            </Link>
            <Link href={links.join.href} className="inline-flex h-12 items-center justify-center rounded-md border border-white/40 px-6 font-semibold text-white transition-colors hover:bg-white/10">
              {links.join.label}
            </Link>
          </div>
          <JoinNote academy={academy} className="text-white/70" />
        </div>
      </div>
      {/* Arch silhouette: the band opens into the page like a doorway. */}
      <svg aria-hidden viewBox="0 0 1440 80" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-12 w-full fill-surface-sunken sm:h-16">
        <path d="M0 80V40C240 40 480 0 720 0s480 40 720 40v40z" />
      </svg>
    </section>
  );
}
