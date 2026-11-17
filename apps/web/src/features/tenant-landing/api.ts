/**
 * TL-5 (ADR-007): Admin API client for tenant landing settings.
 * All calls require `tenant.branding` permission — the backend enforces this.
 */
import { apiClient } from '../../lib/api-client';
import type { TemplateId } from './templates/types';

// ─── Shared types ────────────────────────────────────────────────────────────

export interface LandingPalette {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
}

export interface LandingSections {
  stats: boolean;
  courses: boolean;
  teachers: boolean;
  about: boolean;
  contact: boolean;
  faq: boolean;
}

export interface LandingContactContent {
  phone?: string;
  phone_published?: boolean;
  whatsapp?: string;
  whatsapp_published?: boolean;
  email?: string;
  email_published?: boolean;
  address?: string;
  address_published?: boolean;
  map_url?: string;
  map_url_published?: boolean;
}

export interface LandingContent {
  cover_path?: string | null;
  about?: { text?: string | null; highlights?: string[] };
  contact?: LandingContactContent;
  faq?: Array<{ question: string; answer: string }>;
}

export interface LandingDraft {
  schema: 1;
  template: TemplateId;
  palette: LandingPalette;
  sections: LandingSections;
  content?: LandingContent;
}

export interface LandingStateResponse {
  published: LandingDraft | null;
  draft: LandingDraft | null;
  draft_updated_at: string | null;
  version: number;
  templates: Array<{
    id: TemplateId;
    name_ar: string;
    audience_ar: string;
  }>;
  presets: Array<{
    name_ar: string;
    palette: LandingPalette;
  }>;
}

// ─── Default / empty draft ───────────────────────────────────────────────────

export const DEFAULT_SECTIONS: LandingSections = {
  stats: true,
  courses: true,
  teachers: true,
  about: false,
  contact: false,
  faq: false,
};

export const DEFAULT_LANDING_DRAFT: LandingDraft = {
  schema: 1,
  template: 'oasis',
  palette: {
    primary: '#0C7F6D',
    secondary: '#0B6659',
    accent: '#9C6B36',
    surface: '#F8F8F6',
  },
  sections: DEFAULT_SECTIONS,
};

export const PALETTE_PRESETS: Array<{ nameAr: string; palette: LandingPalette }> = [
  { nameAr: 'الواحة',  palette: { primary: '#0C7F6D', secondary: '#0B6659', accent: '#9C6B36', surface: '#F8F8F6' } },
  { nameAr: 'الصحراء', palette: { primary: '#B45309', secondary: '#92400E', accent: '#6B7280', surface: '#FEF3C7' } },
  { nameAr: 'البحر',   palette: { primary: '#0369A1', secondary: '#0E7490', accent: '#6366F1', surface: '#F0F9FF' } },
  { nameAr: 'الليل',   palette: { primary: '#F59E0B', secondary: '#D97706', accent: '#8B5CF6', surface: '#111827' } },
  { nameAr: 'الربيع',  palette: { primary: '#16A34A', secondary: '#15803D', accent: '#EC4899', surface: '#F7FEE7' } },
  { nameAr: 'الحبر',   palette: { primary: '#1E3A5F', secondary: '#172554', accent: '#64748B', surface: '#F8FAFC' } },
];

// ─── API calls ───────────────────────────────────────────────────────────────

export const landingApi = {
  /** GET /tenant/landing — fetch published + draft + template list + presets */
  getState(): Promise<{ data: LandingStateResponse }> {
    return apiClient.get('/tenant/landing');
  },

  /** PUT /tenant/landing/draft — save full draft (idempotent) */
  saveDraft(draft: Omit<LandingDraft, 'schema'>): Promise<{ data: { message: string } }> {
    return apiClient.put('/tenant/landing/draft', { ...draft, schema: 1 });
  },

  /** POST /tenant/landing/publish — publish draft, bump version */
  publish(): Promise<{ data: { version: number; published_at: string } }> {
    return apiClient.post('/tenant/landing/publish', {});
  },

  /** DELETE /tenant/landing/draft — discard draft, revert to published */
  discardDraft(): Promise<{ data: { message: string } }> {
    return apiClient.delete('/tenant/landing/draft');
  },

  /** POST /tenant/landing/preview-token — 15-min preview token for draft */
  getPreviewToken(): Promise<{ data: { token: string; expires_in: number } }> {
    return apiClient.post('/tenant/landing/preview-token', {});
  },
};
