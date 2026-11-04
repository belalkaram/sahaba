import { apiClient } from './api-client';
import { tokenStore } from './token-store';

export type ReportType = 'student' | 'parent' | 'class_attendance' | 'course_progress' | 'payments';
export type ReportFormat = 'csv' | 'json';

export interface ReportPayload {
  report_title: string;
  type: ReportType;
  generated_at: string;
  summary?: { label: string; value: string | number | null }[];
  columns?: { key: string; label: string }[];
  rows?: Record<string, string | number | null>[];
}

export interface ReportItem {
  id: string;
  title: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  format: ReportFormat;
  file_path?: string | null;
  error_message?: string | null;
  parameters?: Record<string, unknown>;
  data_payload?: ReportPayload | null;
  created_at: string;
  completed_at?: string | null;
}

export const reportApi = {
  async list(): Promise<ReportItem[]> {
    const res = await apiClient.get<{ reports: ReportItem[] }>('/reports');
    return res.data.reports ?? [];
  },

  async get(id: string): Promise<ReportItem> {
    const res = await apiClient.get<{ report: ReportItem }>(`/reports/${id}`);
    return res.data.report;
  },

  async create(payload: {
    title: string;
    type: ReportType;
    format: ReportFormat;
    parameters?: Record<string, string>;
  }): Promise<ReportItem> {
    const res = await apiClient.post<{ report: ReportItem }>('/reports', payload);
    return res.data.report;
  },

  /** Authenticated download: the file is streamed through the API, never a public URL. */
  async downloadFile(report: ReportItem): Promise<void> {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const response = await fetch(`${base.replace(/\/$/, '')}/reports/${report.id}/file`, {
      headers: {
        Authorization: `Bearer ${tokenStore.getToken() ?? ''}`,
        'X-Tenant-Slug': tokenStore.getTenant() ?? '',
      },
    });
    if (!response.ok) throw new Error('تعذّر تنزيل الملف.');

    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.title}.${report.format}`;
    link.click();
    URL.revokeObjectURL(url);
  },
};
