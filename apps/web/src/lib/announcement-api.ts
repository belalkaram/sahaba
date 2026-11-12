import { apiClient } from './api-client';

/** OD-37 (ANN-1): academy announcements. */

export type AnnouncementDisplay = 'bell' | 'banner' | 'modal';
export type AnnouncementFrequency = 'once' | 'persistent';
export type AnnouncementTone = 'info' | 'success' | 'warning' | 'danger';
export type AnnouncementTarget = 'all' | 'courses' | 'classes' | 'grades' | 'students';
export type AnnouncementState = 'live' | 'scheduled' | 'ended' | 'withdrawn';

export interface AnnouncementAudience {
  target: AnnouncementTarget;
  ids: string[];
  students: boolean;
  parents: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  display: AnnouncementDisplay;
  frequency: AnnouncementFrequency;
  tone: AnnouncementTone;
  audience: AnnouncementAudience;
  state: AnnouncementState;
  starts_at: string | null;
  ends_at: string | null;
  withdrawn_at: string | null;
  created_at: string | null;
  author: string | null;
  recipients_count: number;
  seen_count: number;
  dismissed_count: number;
}

export interface AnnouncementOptions {
  scope: 'tenant' | 'own';
  targets: AnnouncementTarget[];
  courses: { id: string; title: string }[];
  classes: { id: string; name: string }[];
  grades: string[];
}

export interface AudiencePreview {
  students: number;
  parents: number;
  recipients: number;
  sample: { name: string; role: 'student' | 'parent' }[];
}

export interface AnnouncementRecipient {
  id: string;
  name: string | null;
  role: 'student' | 'parent';
  student_name: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  seen_count: number;
  dismissed_at: string | null;
}

export interface NewAnnouncement {
  title: string;
  body: string;
  display: AnnouncementDisplay;
  frequency: AnnouncementFrequency | null;
  tone: AnnouncementTone;
  audience: AnnouncementAudience;
  starts_at?: string | null;
  ends_at?: string | null;
}

/** What the signed-in person should see now (banner / modal). */
export interface MyAnnouncement {
  id: string;
  title: string;
  body: string;
  display: 'banner' | 'modal';
  frequency: AnnouncementFrequency;
  tone: AnnouncementTone;
  published_at: string | null;
  ends_at: string | null;
  dismissed_at: string | null;
}

interface Paged<T> {
  items: T[];
  total: number;
  lastPage: number;
}

export const announcementApi = {
  async options(): Promise<AnnouncementOptions> {
    return (await apiClient.get<AnnouncementOptions>('/announcements/options')).data;
  },
  async preview(audience: AnnouncementAudience): Promise<AudiencePreview> {
    return (await apiClient.post<AudiencePreview>('/announcements/preview', { audience })).data;
  },
  async list(params: { status?: AnnouncementState; page?: number }): Promise<Paged<Announcement>> {
    const res = await apiClient.get<{ announcements: Announcement[] }>('/announcements', { params: { ...params, per_page: 20 } });
    const p = res.meta.pagination;
    return { items: res.data.announcements, total: p?.total ?? 0, lastPage: p?.last_page ?? 1 };
  },
  async create(payload: NewAnnouncement): Promise<Announcement> {
    return (await apiClient.post<{ announcement: Announcement }>('/announcements', payload)).data.announcement;
  },
  async recipients(id: string, params: { state?: 'seen' | 'unseen' | 'dismissed'; search?: string; page?: number }): Promise<Paged<AnnouncementRecipient>> {
    const res = await apiClient.get<{ recipients: AnnouncementRecipient[] }>(`/announcements/${id}/recipients`, { params: { ...params, per_page: 25 } });
    const p = res.meta.pagination;
    return { items: res.data.recipients, total: p?.total ?? 0, lastPage: p?.last_page ?? 1 };
  },
  async withdraw(id: string): Promise<Announcement> {
    return (await apiClient.post<{ announcement: Announcement }>(`/announcements/${id}/withdraw`)).data.announcement;
  },

  // Recipient side
  async mine(): Promise<MyAnnouncement[]> {
    return (await apiClient.get<{ announcements: MyAnnouncement[] }>('/me/announcements')).data.announcements;
  },
  async seen(id: string): Promise<void> {
    await apiClient.post(`/me/announcements/${id}/seen`);
  },
  async dismiss(id: string): Promise<void> {
    await apiClient.post(`/me/announcements/${id}/dismiss`);
  },
};
