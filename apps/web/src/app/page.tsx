'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { homePathFor, useAuth } from '../context/auth-context';
import { PublicFooter, PublicHeader } from '../components/layout/public-chrome';
import { LandingHero } from '../features/landing/landing-hero';
import { Faq, FinalCta, HowItWorks, LogosStrip, PublicTeachersSection, RoleFeatures, Testimonials, useScrollReveal } from '../features/landing/landing-sections';

/** Public landing (R7F). Signed-in users go straight to their own dashboard. */
export default function HomePage() {
  const { isAuthenticated, experience, isLoading } = useAuth();
  const router = useRouter();
  const scope = useScrollReveal();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace(homePathFor(experience));
  }, [isLoading, isAuthenticated, experience, router]);

  return (
    <div ref={scope} className="min-h-screen bg-surface-sunken">
      <PublicHeader />
      <main>
        <LandingHero />
        <LogosStrip />
        <PublicTeachersSection />
        <RoleFeatures />
        <HowItWorks />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <PublicFooter />
    </div>
  );
}
