/**
 * Staff list pages for exams and assignments: rows carry their participation and result counters.
 * GET /assessments/exams-overview and /assessments/assignments-overview
 */
import { apiClient } from './api-client';
import type { Page } from '../hooks/use-paged-list';

export interface CourseOption {
  id: string;
  title: string;
  code: string;
}

export interface OverviewFilterValues {
  search: string;
  course_id: string;
  status: string;
  needs: string;
  sort: string;
  date_from: string;
  date_to: string;
}

export const EMPTY_FILTERS: OverviewFilterValues = { search: '', course_id: '', status: '', needs: '', sort: '', date_from: '', date_to: '' };

export interface ExamOverviewStats {
  enrolled: number;
  started: number;
  not_started: number;
  in_progress: number;
  timed_out: number;
  completed: number;
  pending_grading: number;
  graded: number;
  violators: number;
  average_score: number | null;
  highest_score: number | null;
  lowest_score: number | null;
  passed: number;
  failed: number;
}

export interface ExamOverviewRow {
  id: string;
  course_id: string;
  course: CourseOption | null;
  title: string;
  status: 'draft' | 'published' | 'closed' | 'archived' | 'completed';
  is_open: boolean;
  is_grades_published: boolean;
  opens_at: string | null;
  closes_at: string | null;
  duration_minutes: number | null;
  max_attempts: number | null;
  total_points: number | null;
  passing_score: number | null;
  allow_split_sessions: boolean;
  created_at: string;
  questions_count: number;
  stats: ExamOverviewStats;
}

export interface ExamOverviewSummary {
  total: number;
  draft: number;
  published: number;
  closed: number;
  archived: number;
  in_progress: number;
  submitted: number;
  pending_grading: number;
  average_percent: number | null;
}

export interface AssignmentOverviewStats {
  enrolled: number;
  submitted: number;
  not_submitted: number;
  late: number;
  with_file: number;
  pending_grading: number;
  graded: number;
  grades_published: number;
  average_score: number | null;
  highest_score: number | null;
  lowest_score: number | null;
}

export interface AssignmentOverviewRow {
  id: string;
  course_id: string;
  course: CourseOption | null;
  title: string;
  status: 'draft' | 'published' | 'archived';
  due_at: string | null;
  is_past_due: boolean;
  allow_late: boolean;
  allow_resubmission: boolean;
  late_penalty_percent: number;
  points_possible: number | null;
  created_at: string;
  questions_count: number;
  stats: AssignmentOverviewStats;
}

export interface AssignmentOverviewSummary {
  total: number;
  draft: number;
  published: number;
  archived: number;
  past_due_missing: number;
  submitted: number;
  late: number;
  pending_grading: number;
  average_percent: number | null;
}

export interface OverviewPage<T, S> extends Page<T> {
  summary: S;
  courses: CourseOption[];
}

type Raw<T, S> = { summary: S; courses: CourseOption[] } & T;

function toParams(filters: OverviewFilterValues, page: number): Record<string, string | number> {
  const params: Record<string, string | number> = { page, per_page: 12 };
  for (const [key, value] of Object.entries(filters)) {
    if (value) params[key] = value;
  }
  return params;
}

export const assessmentOverviewApi = {
  async exams(filters: OverviewFilterValues, page: number): Promise<OverviewPage<ExamOverviewRow, ExamOverviewSummary>> {
    const res = await apiClient.get<Raw<{ exams: ExamOverviewRow[] }, ExamOverviewSummary>>('/assessments/exams-overview', { params: toParams(filters, page) });
    return {
      items: res.data.exams,
      total: res.meta.pagination?.total ?? res.data.exams.length,
      lastPage: res.meta.pagination?.last_page ?? 1,
      summary: res.data.summary,
      courses: res.data.courses,
    };
  },

  async assignments(filters: OverviewFilterValues, page: number): Promise<OverviewPage<AssignmentOverviewRow, AssignmentOverviewSummary>> {
    const res = await apiClient.get<Raw<{ assignments: AssignmentOverviewRow[] }, AssignmentOverviewSummary>>('/assessments/assignments-overview', { params: toParams(filters, page) });
    return {
      items: res.data.assignments,
      total: res.meta.pagination?.total ?? res.data.assignments.length,
      lastPage: res.meta.pagination?.last_page ?? 1,
      summary: res.data.summary,
      courses: res.data.courses,
    };
  },
};
