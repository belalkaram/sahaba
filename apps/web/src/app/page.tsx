import React from 'react';
import { PublicFooter, PublicHeader } from '../components/layout/public-chrome';
import { LandingHero } from '../features/landing/landing-hero';
import { LandingMotion, SignedInRedirect } from '../features/landing/landing-motion';
import { TrustStrip } from '../features/landing/trust-strip';
import { Analytics, ProblemSolution, Security, Services } from '../features/landing/story-sections';
import { AcademiesSection, TeachersSection } from '../features/landing/showcase';
import { PricingSection } from '../features/landing/pricing-section';
import { Faq, FinalCta, HowItWorks, RoleFeatures, Testimonials } from '../features/landing/landing-sections';
import { getLandingAcademies, getLandingPricing, getLandingStats, getLandingTeachers } from '../features/landing/server-data';

// Keep in step with LANDING_REVALIDATE_SECONDS (route segment config must be a literal).
export const revalidate = 300;

/**
 * Public landing (LANDING-V2). A server component: every section and its data are in the HTML,
 * animation is one client island. Signed-in visitors are redirected by src/proxy.ts.
 *
 * Order tells the story: what the visitor gets → who trusts it → the problem it replaces →
 * the two services → each role's experience → who is already on it → security → analytics →
 * how to start → price → proof → questions → act.
 */
export default async function HomePage() {
  const [teachers, academies, stats, pricing] = await Promise.all([
    getLandingTeachers(),
    getLandingAcademies(),
    getLandingStats(),
    getLandingPricing(),
  ]);

  return (
    <div className="relative isolate min-h-screen">
      <div className="ambient" aria-hidden><i /><i /><i /></div>
      <SignedInRedirect />
      <LandingMotion />
      <PublicHeader />
      <main>
        <LandingHero />
        <TrustStrip stats={stats} academies={academies ?? []} />
        <ProblemSolution />
        <Services />
        <RoleFeatures />
        <AcademiesSection initial={academies} />
        <TeachersSection initial={teachers} />
        <Security />
        <Analytics />
        <HowItWorks />
        <PricingSection pricing={pricing} />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <PublicFooter />
    </div>
  );
}
