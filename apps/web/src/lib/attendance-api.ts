/**
 * Attendance & Offline Learning API Client (Phase R5)
 * Adheres strictly to Master Spec and AGENTS.md.
 */

import { apiClient } from './api-client';
import type {
  AttendanceRecord,
  AttendanceScanResult,
  ClassSession,
  SchoolClass,
  StudentAttendanceSummary,
  StudentQrTokenData,
} from '../types';

export interface ScanAttendancePayload {
  token?: string;
  qr_data?: string;
}

export interface RecordManualAttendancePayload {
  student_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
}

export interface CorrectAttendancePayload {
  status: 'present' | 'absent' | 'late' | 'excused';
  reason: string;
}

export interface CreateClassPayload {
  name: string;
  code?: string;
  branch_id?: string;
  teacher_staff_id?: string;
  status?: 'active' | 'archived';
}

export interface CreateSessionPayload {
  title?: string;
  classroom_id?: string;
  starts_at?: string;
  ends_at?: string;
  attendance_mode?: 'manual' | 'qr' | 'both';
  timing_mode?: 'scheduled' | 'open';
  grace_period_minutes?: number;
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

export interface SessionReportData {
  session: {
    id: string;
    title: string;
    starts_at?: string;
    ends_at?: string;
    status: string;
    attendance_mode: string;
    timing_mode?: string;
    class?: { id: string; name: string } | null;
  };
  summary: {
    total_enrolled: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendance_rate_percentage: number;
  };
  records: AttendanceRecord[];
}

export const attendanceApi = {
  // --- Student QR & Card (R5-1, R5-5) ---
  async getStudentQr(): Promise<StudentQrTokenData> {
    const res = await apiClient.get<StudentQrTokenData>('/me/attendance-qr');
    return res.data;
  },

  async getMyAttendance(): Promise<StudentAttendanceSummary> {
    const res = await apiClient.get<StudentAttendanceSummary>('/me/attendance');
    return res.data;
  },

  // --- Attendance Scanning & Recording (R5-2, R5-4) ---
  async scanAttendance(sessionId: string, payload: ScanAttendancePayload): Promise<AttendanceScanResult> {
    const res = await apiClient.post<AttendanceScanResult>(`/sessions/${sessionId}/attendance/scan`, payload);
    return res.data;
  },

  async scanQr(sessionId: string, qrData: string): Promise<AttendanceScanResult> {
    return this.scanAttendance(sessionId, qrData.includes('.') ? { token: qrData } : { qr_data: qrData });
  },

  async recordManual(sessionId: string, payload: RecordManualAttendancePayload): Promise<{ record: AttendanceRecord }> {
    const res = await apiClient.post<{ record: AttendanceRecord }>(`/sessions/${sessionId}/attendance`, payload);
    return res.data;
  },

  async recordAttendance(
    sessionId: string,
    payload: { student_id: string; status: 'present' | 'absent' | 'late' | 'excused'; attendance_mode?: string; notes?: string }
  ): Promise<{ record: AttendanceRecord }> {
    return this.recordManual(sessionId, {
      student_id: payload.student_id,
      status: payload.status,
      notes: payload.notes,
    });
  },

  async correctAttendance(recordId: string, payload: CorrectAttendancePayload): Promise<{ message: string; record: AttendanceRecord }> {
    const res = await apiClient.put<{ message: string; record: AttendanceRecord }>(`/attendance-records/${recordId}`, payload);
    return res.data;
  },

  async deleteAttendanceRecord(recordId: string, reason?: string): Promise<{ message: string }> {
    const res = await apiClient.delete<{ message: string }>(`/attendance-records/${recordId}`, {
      body: { reason },
    });
    return res.data;
  },

  async getSessionReport(sessionId: string): Promise<SessionReportData> {
    const res = await apiClient.get<SessionReportData>(`/sessions/${sessionId}/attendance/report`);
    return res.data;
  },

  // --- Sessions (R5-4, R5-7) ---
  async getSessions(classIdOrParams?: string | { status?: string; from?: string; to?: string }): Promise<ClassSession[]> {
    if (typeof classIdOrParams === 'string') {
      const res = await apiClient.get<{ sessions: ClassSession[] }>(`/classes/${classIdOrParams}/sessions`);
      return res.data.sessions ?? [];
    }
    const res = await apiClient.get<{ sessions: ClassSession[] }>('/sessions', { params: classIdOrParams });
    return res.data.sessions ?? [];
  },

  async getMyTodaySessions(): Promise<ClassSession[]> {
    const res = await apiClient.get<ClassSession[]>('/me/sessions', {
      params: { date: 'today' },
    });
    return res.data ?? [];
  },

  async getSession(id: string): Promise<ClassSession> {
    const res = await apiClient.get<{ session: ClassSession }>(`/sessions/${id}`);
    return res.data.session;
  },

  async startSession(id: string): Promise<ClassSession> {
    const res = await apiClient.post<{ session: ClassSession }>(`/sessions/${id}/start`);
    return res.data.session;
  },

  async endSession(id: string, markAbsentRemaining = false): Promise<ClassSession> {
    const res = await apiClient.post<{ session: ClassSession }>(`/sessions/${id}/end`, {
      mark_absent_remaining: markAbsentRemaining,
    });
    return res.data.session;
  },

  async cancelSession(id: string): Promise<ClassSession> {
    const res = await apiClient.post<{ session: ClassSession }>(`/sessions/${id}/cancel`);
    return res.data.session;
  },

  async createSession(classId: string, payload: CreateSessionPayload): Promise<ClassSession> {
    const res = await apiClient.post<{ session: ClassSession }>(`/classes/${classId}/sessions`, payload);
    return res.data.session;
  },

  // --- Classes (R5-7) ---
  async getClasses(params?: { branch_id?: string }): Promise<SchoolClass[]> {
    const res = await apiClient.get<{ classes: SchoolClass[] }>('/classes', { params });
    return res.data.classes ?? [];
  },

  async getClass(id: string): Promise<SchoolClass> {
    const res = await apiClient.get<{ class: SchoolClass }>(`/classes/${id}`);
    return res.data.class;
  },

  async createClass(payload: CreateClassPayload): Promise<SchoolClass> {
    const res = await apiClient.post<{ class: SchoolClass }>('/classes', payload);
    return res.data.class;
  },

  async updateClass(id: string, payload: Partial<CreateClassPayload>): Promise<SchoolClass> {
    const res = await apiClient.put<{ class: SchoolClass }>(`/classes/${id}`, payload);
    return res.data.class;
  },

  async deleteClass(id: string): Promise<void> {
    await apiClient.delete(`/classes/${id}`);
  },

  async enrollStudent(classId: string, studentId: string): Promise<void> {
    await apiClient.post(`/classes/${classId}/students`, { student_id: studentId });
  },

  async removeStudent(classId: string, studentId: string): Promise<void> {
    await apiClient.delete(`/classes/${classId}/students/${studentId}`);
  },
};
