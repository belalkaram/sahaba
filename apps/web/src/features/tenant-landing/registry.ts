/**
 * TL-3 (ADR-007): Template registry.
 *
 * Maps each template ID to its manifest and Header component.
 * TL-4 will replace the oasis fallbacks with real implementations for
 * beacon, breeze, atlas, and horizon.
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

export const DEFAULT_TEMPLATE: TemplateId = 'oasis';

interface TemplateEntry {
  manifest: TemplateManifest;
  /** Sticky navigation header rendered by the layout (outside page content). */
  Header: ComponentType;
}

const REGISTRY: Record<TemplateId, TemplateEntry> = {
  oasis:   { manifest: oasisManifest,   Header: OasisHeader },
  beacon:  { manifest: beaconManifest,  Header: BeaconHeader },
  breeze:  { manifest: breezeManifest,  Header: BreezeHeader },
  atlas:   { manifest: atlasManifest,   Header: AtlasHeader },
  horizon: { manifest: horizonManifest, Header: HorizonHeader },
};

/** Returns the registry entry for `id`, falling back to oasis for unknown IDs. */
export function getTemplateEntry(id: string): TemplateEntry {
  return REGISTRY[id as TemplateId] ?? REGISTRY[DEFAULT_TEMPLATE];
}

/** Returns all manifests (for the editor template picker). */
export function getAllManifests(): TemplateManifest[] {
  return (Object.keys(REGISTRY) as TemplateId[]).map((k) => REGISTRY[k].manifest);
}
