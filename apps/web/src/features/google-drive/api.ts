/**
 * Tenant Google connection and direct, resumable Drive uploads (ADR-008, ADR-009).
 * The browser sends the file bytes straight to Google; the API opens the session, reports progress and a worker
 * verifies the file.
 */
import { apiClient } from '../../lib/api-client';
import type { MediaAsset } from '../../types';

export interface GoogleConnectionStatus {
  configured: boolean;
  connected: boolean;
  status: 'connected' | 'error' | 'not_connected';
  account_email: string | null;
  scopes: string[];
  connected_at: string | null;
  last_error: string | null;
}

export interface StartUploadPayload {
  title: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  course_id?: string;
  lesson_id?: string;
}

export const googleIntegrationApi = {
  async status(): Promise<GoogleConnectionStatus> {
    const res = await apiClient.get<{ google: GoogleConnectionStatus }>('/integrations/google');
    return res.data.google;
  },

  /** Returns Google's consent URL; the browser navigates there and comes back to /admin/integrations. */
  async authorizationUrl(): Promise<string> {
    const res = await apiClient.get<{ authorization_url: string }>('/integrations/google/connect');
    return res.data.authorization_url;
  },

  async disconnect(): Promise<GoogleConnectionStatus> {
    const res = await apiClient.delete<{ google: GoogleConnectionStatus }>('/integrations/google');
    return res.data.google;
  },
};

export type UploadStatus = 'pending' | 'finalizing' | 'completed' | 'failed';

export interface DriveUpload {
  id: string;
  status: UploadStatus;
  title: string;
  file_name: string;
  size_bytes: number;
  /** Bytes Google already holds (pending uploads only). */
  received_bytes?: number;
  /** Returned to the uploader only while the session can still be used. */
  upload_url?: string;
  expires_at?: string;
  failure_reason?: string;
  media_asset?: MediaAsset;
}

export const driveUploadApi = {
  async start(payload: StartUploadPayload): Promise<{ upload_id: string; upload_url: string }> {
    const res = await apiClient.post<{ upload_id: string; upload_url: string }>('/media/uploads', payload);
    return res.data;
  },

  /** ADR-009: how far Google got, so a dropped upload resumes instead of starting over. */
  async status(uploadId: string): Promise<DriveUpload> {
    const res = await apiClient.get<{ upload: DriveUpload }>(`/media/uploads/${uploadId}`);
    return res.data.upload;
  },

  /** 201 with the asset, or 202 while the media worker finalises (then poll `status`). */
  async complete(uploadId: string): Promise<DriveUpload> {
    const res = await apiClient.post<{ upload: DriveUpload }>(`/media/uploads/${uploadId}/complete`, {});
    return res.data.upload;
  },
};

/** One PUT of the bytes from `offset` to the end. Rejects on any non-2xx answer or network drop. */
function sendFrom(uploadUrl: string, file: File, offset: number, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    if (offset > 0) xhr.setRequestHeader('Content-Range', `bytes ${offset}-${file.size - 1}/${file.size}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.floor(((offset + event.loaded) / file.size) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`DRIVE_UPLOAD_${xhr.status}`)));
    xhr.onerror = () => reject(new Error('DRIVE_UPLOAD_NETWORK'));
    xhr.send(offset > 0 ? file.slice(offset) : file);
  });
}

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 30000, 30000, 30000, 60000, 60000];

function waitForRetry(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const go = () => {
      window.removeEventListener('online', go);
      resolve();
    };
    // Back off, but start again as soon as the connection is back.
    setTimeout(go, navigator.onLine ? ms : 10 * 60 * 1000);
    if (!navigator.onLine) window.addEventListener('online', go);
  });
}

/**
 * ADR-009: send the file to Google's resumable session; after a drop, ask the API how many bytes Google holds
 * and send only the rest. `startOffset` resumes an upload from an earlier page visit.
 */
export async function uploadToDriveResumable(
  uploadId: string,
  uploadUrl: string,
  file: File,
  onProgress: (percent: number) => void,
  startOffset = 0,
): Promise<void> {
  let offset = startOffset;
  let url = uploadUrl;
  for (let attempt = 0; ; attempt++) {
    try {
      await sendFrom(url, file, offset, onProgress);
      return;
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length) throw err;
      await waitForRetry(RETRY_DELAYS_MS[attempt]);
      const status = await driveUploadApi.status(uploadId).catch(() => null);
      if (status && status.status !== 'pending') return; // Google already has every byte
      if (status) {
        offset = status.received_bytes ?? offset;
        url = status.upload_url ?? url;
        onProgress(Math.floor((offset / file.size) * 100));
      }
    }
  }
}

/** Wait for the media worker after `complete` answered 202. */
export async function waitForFinalized(uploadId: string, first: DriveUpload, timeoutMs = 120000): Promise<DriveUpload> {
  let upload = first;
  const until = Date.now() + timeoutMs;
  while (upload.status === 'finalizing' && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 2000));
    upload = await driveUploadApi.status(uploadId);
  }
  return upload;
}

// ---- An unfinished upload survives a page reload (the teacher picks the same file again) -------------------

const PENDING_KEY = 'lms.driveUpload.pending';

export interface PendingUpload {
  upload_id: string;
  file_name: string;
  size: number;
  last_modified: number;
  title: string;
  course_id?: string;
  lesson_id?: string;
}

export function readPendingUpload(): PendingUpload | null {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingUpload) : null;
  } catch {
    return null;
  }
}

export function savePendingUpload(pending: PendingUpload | null): void {
  try {
    if (pending) window.localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    else window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // Private mode or blocked storage: resuming after a reload is just not offered.
  }
}

export function isSameFile(pending: PendingUpload, file: File): boolean {
  return pending.file_name === file.name && pending.size === file.size && pending.last_modified === file.lastModified;
}

export type MediaVerification = 'verified' | 'unverified';

export function mediaVerification(asset: MediaAsset): MediaVerification {
  return asset.metadata?.verification === 'verified' ? 'verified' : 'unverified';
}
