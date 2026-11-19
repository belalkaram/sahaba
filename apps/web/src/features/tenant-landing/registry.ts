/**
 * TL-3 (ADR-007): Template registry.
 *
 * Maps each template ID to its manifest and Header component.
 * Each template owns its Header and home Hero; cards, section titles and content panels are
 * re-styled per template through `templates.css` (scoped by [data-template]).
 */
import type { ComponentType } from 'react';
import { oasisManifest }   from './templates/oasis/manifest';
import { beaconManifest }  from './templates/beacon/manifest';
import { breezeManifest }  from './templates/breeze/manifest';
import { atlasManifest }   from './templates/atlas/manifest';
import { horizonManifest } from './templates/horizon/manifest';
import type { TemplateManifest, TemplateId } from './templates/types';

// Header components — one per template (TL-4).
import { OasisHeader }   from './templates/oasis/header';
import { BeaconHeader }  from './templates/beacon/header';
import { BreezeHeader }  from './templates/breeze/header';
import { AtlasHeader }   from './templates/atlas/header';
import { HorizonHeader } from './templates/horizon/header';

// Hero components — the first band of the academy home, one per template.
import { OasisHero }   from './templates/oasis/hero';
import { BeaconHero }  from './templates/beacon/hero';
import { BreezeHero }  from './templates/breeze/hero';
import { AtlasHero }   from './templates/atlas/hero';
import { HorizonHero } from './templates/horizon/hero';
import type { HeroProps } from './templates/hero-parts';

export const DEFAULT_TEMPLATE: TemplateId = 'oasis';

interface TemplateEntry {
  manifest: TemplateManifest;
  /** Sticky navigation header rendered by the layout (outside page content). */
  Header: ComponentType;
  /** Home-page hero. The rest of the page is styled per template by templates.css. */
  Hero: ComponentType<HeroProps>;
}

const REGISTRY: Record<TemplateId, TemplateEntry> = {
  oasis:   { manifest: oasisManifest,   Header: OasisHeader,   Hero: OasisHero },
  beacon:  { manifest: beaconManifest,  Header: BeaconHeader,  Hero: BeaconHero },
  breeze:  { manifest: breezeManifest,  Header: BreezeHeader,  Hero: BreezeHero },
  atlas:   { manifest: atlasManifest,   Header: AtlasHeader,   Hero: AtlasHero },
  horizon: { manifest: horizonManifest, Header: HorizonHeader, Hero: HorizonHero },
};

/** Returns the registry entry for `id`, falling back to oasis for unknown IDs. */
export function getTemplateEntry(id: string): TemplateEntry {
  return REGISTRY[id as TemplateId] ?? REGISTRY[DEFAULT_TEMPLATE];
}

/** Returns all manifests (for the editor template picker). */
export function getAllManifests(): TemplateManifest[] {
  return (Object.keys(REGISTRY) as TemplateId[]).map((k) => REGISTRY[k].manifest);
}
