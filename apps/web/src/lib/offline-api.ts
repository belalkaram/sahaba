import { apiClient } from './api-client';
import type {
  OfflineHomeworkCheck,
  OfflineAssessment,
  OfflineAssessmentScore,
} from '../types';

export interface RecordHomeworkPayload {
  student_id: string;
  status: 'done' | 'partial' | 'not_done' | 'absent';
  note?: string;
}

export interface CreateOfflineAssessmentPayload {
  title: string;
  max_score: number;
  date?: string;
  session_id?: string;
  description?: string;
}

export interface RecordOfflineScorePayload {
  student_id: string;
  score?: number;
  is_absent?: boolean;
  notes?: string;
}

export const offlineApi = {
  // Homework Checks
  async getHomeworkChecks(sessionId: string): Promise<OfflineHomeworkCheck[]> {
    const res = await apiClient.get<{ checks: OfflineHomeworkCheck[] }>(
      `/sessions/${sessionId}/homework-checks`
    );
    return res.data.checks ?? [];
  },

  async recordHomeworkCheck(
    sessionId: string,
    payload: RecordHomeworkPayload
  ): Promise<OfflineHomeworkCheck> {
    const res = await apiClient.post<{ check: OfflineHomeworkCheck }>(
      `/sessions/${sessionId}/homework-checks`,
      payload
    );
    return res.data.check;
  },

  async bulkRecordHomeworkChecks(
    sessionId: string,
    checks: RecordHomeworkPayload[]
  ): Promise<{ count: number; checks: OfflineHomeworkCheck[] }> {
    const res = await apiClient.post<{ count: number; checks: OfflineHomeworkCheck[] }>(
      `/sessions/${sessionId}/homework-checks/bulk`,
      { checks }
    );
    return res.data;
  },

  // Offline Assessments & Paper Scores
  async getClassOfflineAssessments(classId: string): Promise<OfflineAssessment[]> {
    const res = await apiClient.get<{ assessments: OfflineAssessment[] }>(
      `/classes/${classId}/offline-assessments`
    );
    return res.data.assessments ?? [];
  },

  async createOfflineAssessment(
    classId: string,
    payload: CreateOfflineAssessmentPayload
  ): Promise<OfflineAssessment> {
    const res = await apiClient.post<{ assessment: OfflineAssessment }>(
      `/classes/${classId}/offline-assessments`,
      payload
    );
    return res.data.assessment;
  },

  async getOfflineAssessment(id: string): Promise<OfflineAssessment> {
    const res = await apiClient.get<{ assessment: OfflineAssessment }>(
      `/offline-assessments/${id}`
    );
    return res.data.assessment;
  },

  async recordOfflineScores(
    id: string,
    scores: RecordOfflineScorePayload[]
  ): Promise<{ count: number; scores: OfflineAssessmentScore[] }> {
    const res = await apiClient.post<{ count: number; scores: OfflineAssessmentScore[] }>(
      `/offline-assessments/${id}/scores`,
      { scores }
    );
    return res.data;
  },
};
