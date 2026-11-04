/**
 * Live Meetings & Media Domain API Service
 */
import { apiClient } from './api-client';
import type { Meeting, MediaAsset } from '../types';

export interface CreateMeetingPayload {
  title: string;
  description?: string;
  provider?: 'manual' | 'google_meet' | 'zoom' | 'mock';
  meeting_code?: string;
  meet_url?: string;
  duration_minutes?: number;
  course_id?: string;
  session_id?: string;
  start_time?: string;
}

export interface UploadMediaPayload {
  title: string;
  provider?: 'google_drive' | 'vimeo' | 'mock';
  external_id?: string;
  media_type?: 'video' | 'audio' | 'document';
  course_id?: string;
  lesson_id?: string;
  metadata?: Record<string, unknown>;
}

export const integrationApi = {
  /**
   * Fetch meetings with optional filters.
   */
  async getMeetings(params?: { course_id?: string; session_id?: string; status?: string }): Promise<Meeting[]> {
    const query = new URLSearchParams();
    if (params?.course_id) query.append('course_id', params.course_id);
    if (params?.session_id) query.append('session_id', params.session_id);
    if (params?.status) query.append('status', params.status);

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<{ meetings: Meeting[] }>(`/meetings${qs}`);
    return res.data.meetings ?? [];
  },

  /**
   * Create a live meeting (Google Meet, Zoom, or Mock).
   */
  async createMeeting(payload: CreateMeetingPayload): Promise<Meeting> {
    const res = await apiClient.post<{ meeting: Meeting }>('/meetings', payload);
    return res.data.meeting;
  },

  /** The link is issued only after the backend access and time-window checks. */
  async getMeetingJoinUrl(id: string): Promise<string> {
    const res = await apiClient.get<{ join_url: string }>(`/meetings/${id}/join`);
    return res.data.join_url;
  },

  /**
   * Cancel a meeting.
   */
  async cancelMeeting(id: string): Promise<boolean> {
    const res = await apiClient.post<{ success: boolean }>(`/meetings/${id}/cancel`, {});
    return res.data.success ?? true;
  },

  /**
   * Fetch media assets (videos, files) with optional filters.
   */
  async getMedia(params?: { course_id?: string; lesson_id?: string; media_type?: string }): Promise<MediaAsset[]> {
    const query = new URLSearchParams();
    if (params?.course_id) query.append('course_id', params.course_id);
    if (params?.lesson_id) query.append('lesson_id', params.lesson_id);
    if (params?.media_type) query.append('media_type', params.media_type);

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<{ media_assets?: MediaAsset[]; media?: MediaAsset[] }>(`/media${qs}`);
    return res.data.media_assets ?? res.data.media ?? [];
  },

  /**
   * Register or upload a video / media asset (e.g. Google Drive).
   */
  async uploadMedia(payload: UploadMediaPayload): Promise<MediaAsset> {
    const res = await apiClient.post<{ media_asset: MediaAsset }>('/media', payload);
    return res.data.media_asset;
  },

  /**
   * Get secure embed URL for media asset.
   */
  async getMediaEmbed(id: string): Promise<string> {
    const res = await apiClient.get<{ embed_url: string }>(`/media/${id}/embed`);
    return res.data.embed_url;
  },
};
