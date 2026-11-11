/**
 * Assessment Domain API Client (Exams, Assignments, Question Banks, Grading Inbox)
 */
import { apiClient, ApiError } from './api-client';
import type {
  Assignment,
  AssignmentQuestion,
  AssignmentSubmission,
  BankQuestion,
  Exam,
  ExamAttempt,
  ExamQuestion,
  Grade,
  ModelAnswerItem,
  ModelAnswerStudentRow,
  PendingGradingResponse,
  QuestionBank,
} from '../types';

export interface CreateAssignmentPayload {
  title: string;
  lesson_id?: string;
  description?: string;
  points_possible?: number;
  due_at?: string;
  allow_late?: boolean;
  late_penalty_percent?: number;
  allow_resubmission?: boolean;
  max_file_size_mb?: number;
  allowed_file_types?: string;
  auto_release_model_answers?: boolean;
  status?: 'draft' | 'published' | 'archived';
}

export interface CreateExamPayload {
  title: string;
  description?: string;
  opens_at?: string;
  closes_at?: string;
  duration_minutes?: number;
  max_attempts?: number;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  show_results?: 'after_submit' | 'after_publish' | 'never';
  total_points?: number;
  passing_score?: number;
  allow_split_sessions?: boolean;
  auto_release_model_answers?: boolean;
  status?: 'draft' | 'published' | 'closed' | 'archived';
}

export interface CreateQuestionPayload {
  question_text: string;
  question_type: 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_answer' | 'essay';
  points?: number;
  options?: string[];
  correct_answer?: string;
  acceptable_answers?: string[];
  explanation?: string;
  model_answer?: string;
  sort_order?: number;
}

export type AssessmentKind = 'exams' | 'assignments';
export type ReleaseTarget =
  | { scope: 'all' }
  | { scope: 'class'; class_id: string }
  | { scope: 'student'; student_ids: string[] };

export interface AnswerPayload {
  question_id: string;
  answer_text?: string;
  selected_options?: string[];
}

export const assessmentApi = {
  // ==========================================
  // ASSIGNMENTS
  // ==========================================

  async getAssignments(courseId: string): Promise<Assignment[]> {
    const res = await apiClient.get<{ assignments: Assignment[] }>(`/courses/${courseId}/assignments`);
    return res.data.assignments ?? [];
  },

  async getAssignment(courseId: string, id: string): Promise<{ assignment: Assignment; student_submission?: AssignmentSubmission }> {
    const res = await apiClient.get<{ assignment: Assignment; student_submission?: AssignmentSubmission }>(
      `/courses/${courseId}/assignments/${id}`
    );
    return res.data;
  },

  async createAssignment(courseId: string, payload: CreateAssignmentPayload): Promise<Assignment> {
    const res = await apiClient.post<{ assignment: Assignment }>(`/courses/${courseId}/assignments`, payload);
    return res.data.assignment;
  },

  async updateAssignment(courseId: string, id: string, payload: Partial<CreateAssignmentPayload>): Promise<Assignment> {
    const res = await apiClient.put<{ assignment: Assignment }>(`/courses/${courseId}/assignments/${id}`, payload);
    return res.data.assignment;
  },

  async deleteAssignment(courseId: string, id: string): Promise<void> {
    await apiClient.delete(`/courses/${courseId}/assignments/${id}`);
  },

  async submitAssignment(
    courseId: string,
    assignmentId: string,
    data: { content?: string; file?: File; answers?: AnswerPayload[] } | string
  ): Promise<AssignmentSubmission> {
    const payload = typeof data === 'string' ? { content: data } : data;

    if (payload.file) {
      const formData = new FormData();
      if (payload.content) formData.append('content', payload.content);
      if (payload.answers?.length) formData.append('answers', JSON.stringify(payload.answers));
      formData.append('file', payload.file);

      const res = await apiClient.post<{ submission: AssignmentSubmission }>(
        `/courses/${courseId}/assignments/${assignmentId}/submit`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return res.data.submission;
    }

    const res = await apiClient.post<{ submission: AssignmentSubmission }>(
      `/courses/${courseId}/assignments/${assignmentId}/submit`,
      { content: payload.content ?? '' }
    );
    return res.data.submission;
  },

  async getAssignmentSubmissions(courseId: string, assignmentId: string): Promise<AssignmentSubmission[]> {
    const res = await apiClient.get<{ submissions: AssignmentSubmission[] }>(
      `/courses/${courseId}/assignments/${assignmentId}/submissions`
    );
    return res.data.submissions ?? [];
  },

  async gradeSubmission(
    courseId: string,
    assignmentId: string,
    submissionId: string,
    score: number,
    feedback?: string,
    isGradePublished?: boolean
  ): Promise<void> {
    await apiClient.post(
      `/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}/grade`,
      { score, feedback, is_grade_published: isGradePublished }
    );
  },

  async publishAssignmentGrades(courseId: string, assignmentId: string): Promise<void> {
    await apiClient.post(`/courses/${courseId}/assignments/${assignmentId}/publish-grades`);
  },

  getSubmissionFileDownloadUrl(courseId: string, assignmentId: string, submissionId: string): string {
    return `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}/file`;
  },

  // ==========================================
  // EXAMS & LIFECYCLE
  // ==========================================

  async getExams(courseId: string): Promise<Exam[]> {
    const res = await apiClient.get<{ exams: Exam[] }>(`/courses/${courseId}/exams`);
    return res.data.exams ?? [];
  },

  async getExam(courseId: string, id: string): Promise<{ exam: Exam; student_attempts?: ExamAttempt[]; can_attempt?: boolean }> {
    const res = await apiClient.get<{ exam: Exam; student_attempts?: ExamAttempt[]; can_attempt?: boolean }>(
      `/courses/${courseId}/exams/${id}`
    );
    return res.data;
  },

  async createExam(courseId: string, payload: CreateExamPayload): Promise<Exam> {
    const res = await apiClient.post<{ exam: Exam }>(`/courses/${courseId}/exams`, payload);
    return res.data.exam;
  },

  async updateExam(courseId: string, id: string, payload: Partial<CreateExamPayload>): Promise<Exam> {
    const res = await apiClient.put<{ exam: Exam }>(`/courses/${courseId}/exams/${id}`, payload);
    return res.data.exam;
  },

  async deleteExam(courseId: string, id: string): Promise<void> {
    await apiClient.delete(`/courses/${courseId}/exams/${id}`);
  },

  async publishExam(courseId: string, id: string): Promise<Exam> {
    const res = await apiClient.post<{ exam: Exam }>(`/courses/${courseId}/exams/${id}/publish`);
    return res.data.exam;
  },

  async closeExam(courseId: string, id: string): Promise<Exam> {
    const res = await apiClient.post<{ exam: Exam }>(`/courses/${courseId}/exams/${id}/close`);
    return res.data.exam;
  },

  async archiveExam(courseId: string, id: string): Promise<Exam> {
    const res = await apiClient.post<{ exam: Exam }>(`/courses/${courseId}/exams/${id}/archive`);
    return res.data.exam;
  },

  // ==========================================
  // EXAM QUESTIONS
  // ==========================================

  async getExamQuestions(courseId: string, examId: string, withAnswers = false): Promise<ExamQuestion[]> {
    const res = await apiClient.get<{ questions: ExamQuestion[] }>(
      `/courses/${courseId}/exams/${examId}/questions`,
      { params: withAnswers ? { with_answers: 1 } : {} }
    );
    return res.data.questions ?? [];
  },

  async addExamQuestion(courseId: string, examId: string, payload: CreateQuestionPayload): Promise<ExamQuestion> {
    const res = await apiClient.post<{ question: ExamQuestion }>(
      `/courses/${courseId}/exams/${examId}/questions`,
      payload
    );
    return res.data.question;
  },

  async updateExamQuestion(courseId: string, examId: string, questionId: string, payload: Partial<CreateQuestionPayload>): Promise<ExamQuestion> {
    const res = await apiClient.put<{ question: ExamQuestion }>(
      `/courses/${courseId}/exams/${examId}/questions/${questionId}`,
      payload
    );
    return res.data.question;
  },

  async deleteExamQuestion(courseId: string, examId: string, questionId: string): Promise<void> {
    await apiClient.delete(`/courses/${courseId}/exams/${examId}/questions/${questionId}`);
  },

  async reorderExamQuestions(courseId: string, examId: string, items: Array<{ id: string; sort_order: number }>): Promise<void> {
    await apiClient.post(`/courses/${courseId}/exams/${examId}/questions/reorder`, { items });
  },

  // ==========================================
  // EXAM RUNNER & ATTEMPTS
  // ==========================================

  // ---- Assessment v2: heartbeat, assignment questions, images, model answers ----------------------

  /** Split-session exams: charges active time and returns the authoritative remaining time. `resume` = first beat of a new sitting. */
  async heartbeat(courseId: string, examId: string, attemptId: string, resume = false): Promise<{ status: string; expired: boolean; remaining_seconds: number }> {
    const res = await apiClient.post<{ status: string; expired: boolean; remaining_seconds: number }>(
      `/courses/${courseId}/exams/${examId}/attempts/${attemptId}/heartbeat`,
      resume ? { resume: true } : {},
    );
    return res.data;
  },

  async getAssignmentQuestions(courseId: string, assignmentId: string, withAnswers = false): Promise<AssignmentQuestion[]> {
    const res = await apiClient.get<{ questions: AssignmentQuestion[] }>(
      `/courses/${courseId}/assignments/${assignmentId}/questions${withAnswers ? '?with_answers=1' : ''}`,
    );
    return res.data.questions ?? [];
  },

  async addAssignmentQuestion(courseId: string, assignmentId: string, payload: CreateQuestionPayload): Promise<AssignmentQuestion> {
    const res = await apiClient.post<{ question: AssignmentQuestion }>(`/courses/${courseId}/assignments/${assignmentId}/questions`, payload);
    return res.data.question;
  },

  async updateAssignmentQuestion(courseId: string, assignmentId: string, questionId: string, payload: Partial<CreateQuestionPayload>): Promise<AssignmentQuestion> {
    const res = await apiClient.put<{ question: AssignmentQuestion }>(`/courses/${courseId}/assignments/${assignmentId}/questions/${questionId}`, payload);
    return res.data.question;
  },

  async deleteAssignmentQuestion(courseId: string, assignmentId: string, questionId: string): Promise<void> {
    await apiClient.delete(`/courses/${courseId}/assignments/${assignmentId}/questions/${questionId}`);
  },

  /** Upload (or replace) the image of a question, or of its model answer. */
  async uploadQuestionImage(courseId: string, kind: AssessmentKind, itemId: string, questionId: string, file: File, variant: 'question' | 'model_answer' = 'question'): Promise<void> {
    const form = new FormData();
    form.append('image', file);
    form.append('variant', variant);
    await apiClient.post(`/courses/${courseId}/${kind}/${itemId}/questions/${questionId}/image`, form);
  },

  async deleteQuestionImage(courseId: string, kind: AssessmentKind, itemId: string, questionId: string, variant: 'question' | 'model_answer' = 'question'): Promise<void> {
    await apiClient.delete(`/courses/${courseId}/${kind}/${itemId}/questions/${questionId}/image?variant=${variant}`);
  },

  /** Authenticated image fetch (an <img> cannot send the bearer token). */
  questionImageBlob(courseId: string, kind: AssessmentKind, itemId: string, questionId: string, variant: 'question' | 'model_answer' = 'question'): Promise<Blob> {
    return apiClient.blob(`/courses/${courseId}/${kind}/${itemId}/questions/${questionId}/image?variant=${variant}`);
  },

  async getModelAnswers(courseId: string, kind: AssessmentKind, itemId: string): Promise<{ title: string; questions: ModelAnswerItem[] }> {
    const res = await apiClient.get<{ title: string; questions: ModelAnswerItem[] }>(`/courses/${courseId}/${kind}/${itemId}/model-answers`);
    return res.data;
  },

  async getModelAnswerStatus(courseId: string, kind: AssessmentKind, itemId: string): Promise<{ auto_release: boolean; students: ModelAnswerStudentRow[] }> {
    const res = await apiClient.get<{ auto_release: boolean; students: ModelAnswerStudentRow[] }>(`/courses/${courseId}/${kind}/${itemId}/model-answers/status`);
    return res.data;
  },

  async releaseModelAnswers(courseId: string, kind: AssessmentKind, itemId: string, target: ReleaseTarget): Promise<void> {
    await apiClient.post(`/courses/${courseId}/${kind}/${itemId}/model-answers/release`, target);
  },

  async revokeModelAnswers(courseId: string, kind: AssessmentKind, itemId: string, target: ReleaseTarget): Promise<void> {
    await apiClient.post(`/courses/${courseId}/${kind}/${itemId}/model-answers/revoke`, target);
  },

  async setModelAnswerAutoRelease(courseId: string, kind: AssessmentKind, itemId: string, enabled: boolean): Promise<void> {
    await apiClient.post(`/courses/${courseId}/${kind}/${itemId}/model-answers/auto-release`, { enabled });
  },

  async startExam(courseId: string, examId: string): Promise<ActiveExamAttempt> {
    const res = await apiClient.post<ActiveExamAttempt>(`/courses/${courseId}/exams/${examId}/start`);
    return res.data;
  },

  async getAttempt(courseId: string, examId: string, attemptId: string): Promise<{
    attempt: ExamAttempt;
    server_now: string;
    expires_at?: string;
    remaining_seconds: number;
  }> {
    const res = await apiClient.get<{
      attempt: ExamAttempt;
      server_now: string;
      expires_at?: string;
      remaining_seconds: number;
    }>(`/courses/${courseId}/exams/${examId}/attempts/${attemptId}`);
    return res.data;
  },

  /** Resume the student's in-progress attempt (after reload/reconnect). Returns null when there is none. */
  async getActiveAttempt(courseId: string, examId: string): Promise<ActiveExamAttempt | null> {
    try {
      const res = await apiClient.get<ActiveExamAttempt>(`/courses/${courseId}/exams/${examId}/active-attempt`);
      return res.data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },

  async recordIntegrityEvent(
    courseId: string,
    examId: string,
    attemptId: string,
    type: IntegrityEventType,
  ): Promise<{ violation_count: number; max_violations: number; auto_submitted: boolean }> {
    const res = await apiClient.post<{ violation_count: number; max_violations: number; auto_submitted: boolean }>(
      `/courses/${courseId}/exams/${examId}/attempts/${attemptId}/integrity-events`,
      { type },
    );
    return res.data;
  },

  async submitExamAnswer(
    courseId: string,
    examId: string,
    attemptId: string,
    questionIdOrData: string | { question_id: string; answer_text?: string; selected_options?: string[] },
    answerData?: any
  ): Promise<void> {
    const payload =
      typeof questionIdOrData === 'string'
        ? { question_id: questionIdOrData, ...answerData }
        : questionIdOrData;

    await apiClient.post(
      `/courses/${courseId}/exams/${examId}/attempts/${attemptId}/answers`,
      payload
    );
  },

  async submitExam(courseId: string, examId: string, attemptId: string): Promise<{
    message: string;
    attempt: ExamAttempt;
    already_submitted?: boolean;
  }> {
    const res = await apiClient.post<{
      message: string;
      attempt: ExamAttempt;
      already_submitted?: boolean;
    }>(`/courses/${courseId}/exams/${examId}/attempts/${attemptId}/submit`);
    return res.data;
  },

  async getExamResults(courseId: string, examId: string, attemptId: string): Promise<{
    attempt: {
      id: string;
      score?: number;
      total_points: number;
      feedback?: string;
      submitted_at?: string;
      status: string;
    };
    answers?: Array<{
      question_id: string;
      question_text: string;
      question_type: string;
      points: number;
      student_answer?: string;
      selected_options?: string[];
      is_correct?: boolean;
      awarded_points?: number;
      correct_answer?: string;
      explanation?: string;
      feedback?: string;
    }>;
    details_hidden?: boolean;
    message?: string;
  }> {
    const res = await apiClient.get<any>(`/courses/${courseId}/exams/${examId}/attempts/${attemptId}/results`);
    return res.data;
  },

  async gradeExamAttempt(
    courseId: string,
    examId: string,
    attemptId: string,
    data: {
      score: number;
      feedback?: string;
      answers_scores?: Array<{ question_id: string; awarded_points: number; feedback?: string }>;
    }
  ): Promise<{ attempt: ExamAttempt }> {
    const res = await apiClient.post<{ attempt: ExamAttempt }>(
      `/courses/${courseId}/exams/${examId}/attempts/${attemptId}/grade`,
      data
    );
    return res.data;
  },

  async publishExamGrades(courseId: string, examId: string): Promise<void> {
    await apiClient.post(`/courses/${courseId}/exams/${examId}/publish-grades`);
  },

  // ==========================================
  // QUESTION BANKS
  // ==========================================

  async getQuestionBanks(courseId: string): Promise<QuestionBank[]> {
    const res = await apiClient.get<{ question_banks: QuestionBank[] }>(`/courses/${courseId}/question-banks`);
    return res.data.question_banks ?? [];
  },

  async createQuestionBank(courseId: string, payload: { title: string; description?: string }): Promise<QuestionBank> {
    const res = await apiClient.post<{ question_bank: QuestionBank }>(`/courses/${courseId}/question-banks`, payload);
    return res.data.question_bank;
  },

  async getQuestionBank(courseId: string, bankId: string): Promise<{ question_bank: QuestionBank; questions: BankQuestion[] }> {
    const res = await apiClient.get<{ question_bank: QuestionBank; questions: BankQuestion[] }>(
      `/courses/${courseId}/question-banks/${bankId}`
    );
    return res.data;
  },

  async updateQuestionBank(courseId: string, bankId: string, payload: { title?: string; description?: string }): Promise<QuestionBank> {
    const res = await apiClient.put<{ question_bank: QuestionBank }>(`/courses/${courseId}/question-banks/${bankId}`, payload);
    return res.data.question_bank;
  },

  async deleteQuestionBank(courseId: string, bankId: string): Promise<void> {
    await apiClient.delete(`/courses/${courseId}/question-banks/${bankId}`);
  },

  async addBankQuestion(courseId: string, bankId: string, payload: CreateQuestionPayload): Promise<BankQuestion> {
    const res = await apiClient.post<{ question: BankQuestion }>(
      `/courses/${courseId}/question-banks/${bankId}/questions`,
      payload
    );
    return res.data.question;
  },

  async updateBankQuestion(
    courseId: string,
    bankId: string,
    questionId: string,
    payload: Partial<CreateQuestionPayload>
  ): Promise<BankQuestion> {
    const res = await apiClient.put<{ question: BankQuestion }>(
      `/courses/${courseId}/question-banks/${bankId}/questions/${questionId}`,
      payload
    );
    return res.data.question;
  },

  async deleteBankQuestion(courseId: string, bankId: string, questionId: string): Promise<void> {
    await apiClient.delete(`/courses/${courseId}/question-banks/${bankId}/questions/${questionId}`);
  },

  async importBankQuestionsToExam(courseId: string, examId: string, bankId: string, questionIds?: string[]): Promise<void> {
    await apiClient.post(`/courses/${courseId}/exams/${examId}/questions/import-from-bank`, {
      bank_id: bankId,
      question_ids: questionIds,
    });
  },

  // ==========================================
  // GRADING INBOX & BULK PUBLISH
  // ==========================================

  async getPendingGrading(): Promise<PendingGradingResponse> {
    const res = await apiClient.get<PendingGradingResponse>('/grading/pending');
    return res.data;
  },

  async bulkPublishGrades(payload: { exam_ids?: string[]; assignment_ids?: string[] }): Promise<{ published_count: number }> {
    const res = await apiClient.post<{ published_count: number }>('/grading/publish-bulk', payload);
    return res.data;
  },

  // ==========================================
  // GRADES
  // ==========================================

  async getStudentGrades(studentId: string): Promise<Grade[]> {
    const res = await apiClient.get<{ grades: Grade[] }>(`/students/${studentId}/grades`);
    return res.data.grades ?? [];
  },
};

export type IntegrityEventType =
  | 'tab_hidden'
  | 'window_blur'
  | 'fullscreen_exit'
  | 'copy_attempt'
  | 'paste_attempt'
  | 'context_menu'
  | 'blocked_shortcut'
  | 'devtools_suspected';

export interface ActiveExamAttempt {
  attempt: ExamAttempt;
  server_now: string;
  remaining_seconds: number;
  max_violations: number;
  /** Split-session exam: several sittings inside the window, only active time counts. */
  split_sessions?: boolean;
  window_closes_at?: string | null;
  questions: ExamQuestion[];
}
