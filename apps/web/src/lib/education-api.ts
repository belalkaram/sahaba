/**
 * Education Domain API Service (Courses, Modules, Lessons, Materials, Progress)
 * Adheres to Phase R4 and Master Spec contracts.
 */
import { apiClient } from './api-client';
import type {
  Course,
  CourseModule,
  Lesson,
  LessonMaterial,
  LessonProgressData,
  Student,
} from '../types';

export interface CreateCoursePayload {
  title: string;
  code?: string;
  description?: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  status?: 'draft' | 'published' | 'archived';
  is_free?: boolean;
  /** Opt-in: list this (published) course on the academy's public landing pages. */
  is_public?: boolean;
}

export type UpdateCoursePayload = Partial<CreateCoursePayload>;

export interface CreateModulePayload {
  title: string;
  description?: string;
  sort_order?: number;
  status?: 'draft' | 'published';
}

export interface CreateLessonPayload {
  module_id?: string | null;
  title: string;
  content?: string;
  type?: 'video' | 'document' | 'text' | 'assignment' | 'exam' | 'live';
  duration_seconds?: number;
  ref_id?: string;
  sort_order?: number;
  status?: 'draft' | 'published';
  is_free_preview?: boolean;
}

export type UpdateLessonPayload = Partial<CreateLessonPayload>;

export interface VideoPlaybackEvent {
  type: 'start' | 'heartbeat' | 'seek' | 'pause' | 'end';
  position_seconds: number;
  client_ts?: number;
}

export interface CourseStudentProgress {
  student_id: string;
  name: string;
  student_code: string;
  lessons_completed: number;
  total_lessons: number;
  completion_percent: number;
  last_active?: string | null;
}

export interface CourseProgressOverview {
  course_id: string;
  total_students: number;
  students: CourseStudentProgress[];
}

export const educationApi = {
  // --- Courses ---
  async getCourses(): Promise<Course[]> {
    const res = await apiClient.get<{ courses: Course[] }>('/courses');
    return res.data.courses ?? [];
  },

  async getCourse(id: string): Promise<Course> {
    const res = await apiClient.get<{ course: Course }>(`/courses/${id}`);
    return res.data.course;
  },

  async getCourseOutline(id: string): Promise<Course> {
    const res = await apiClient.get<{ course: Course }>(`/courses/${id}/outline`);
    return res.data.course;
  },

  async createCourse(data: CreateCoursePayload): Promise<Course> {
    const res = await apiClient.post<{ course: Course }>('/courses', data);
    return res.data.course;
  },

  async updateCourse(id: string, data: UpdateCoursePayload): Promise<Course> {
    const res = await apiClient.put<{ course: Course }>(`/courses/${id}`, data);
    return res.data.course;
  },

  async uploadCourseCover(id: string, file: File): Promise<Course> {
    const form = new FormData();
    form.append('image', file);
    const res = await apiClient.post<{ course: Course }>(`/courses/${id}/cover`, form);
    return res.data.course;
  },

  async deleteCourseCover(id: string): Promise<Course> {
    const res = await apiClient.delete<{ course: Course }>(`/courses/${id}/cover`);
    return res.data.course;
  },

  courseCoverBlob(id: string): Promise<Blob> {
    return apiClient.blob(`/courses/${id}/cover`);
  },

  async publishCourse(id: string): Promise<void> {
    await apiClient.post(`/courses/${id}/publish`);
  },

  async unpublishCourse(id: string): Promise<void> {
    await apiClient.post(`/courses/${id}/unpublish`);
  },

  async deleteCourse(id: string): Promise<void> {
    await apiClient.delete(`/courses/${id}`);
  },

  async getCourseProgress(id: string): Promise<CourseProgressOverview> {
    const res = await apiClient.get<CourseProgressOverview>(`/courses/${id}/progress`);
    return res.data;
  },

  // --- Modules ---
  async getModules(courseId: string): Promise<CourseModule[]> {
    const res = await apiClient.get<{ modules: CourseModule[] }>(`/courses/${courseId}/modules`);
    return res.data.modules ?? [];
  },

  async createModule(courseId: string, data: CreateModulePayload): Promise<CourseModule> {
    const res = await apiClient.post<{ module: CourseModule }>(`/courses/${courseId}/modules`, data);
    return res.data.module;
  },

  async updateModule(id: string, data: Partial<CreateModulePayload>): Promise<CourseModule> {
    const res = await apiClient.put<{ module: CourseModule }>(`/modules/${id}`, data);
    return res.data.module;
  },

  async deleteModule(id: string): Promise<void> {
    await apiClient.delete(`/modules/${id}`);
  },

  async reorderModules(courseId: string, modules: Array<{ id: string; sort_order: number }>): Promise<void> {
    await apiClient.post(`/courses/${courseId}/modules/reorder`, { modules });
  },

  // --- Lessons ---
  async getLessons(courseId: string): Promise<Lesson[]> {
    const res = await apiClient.get<{ lessons: Lesson[] }>(`/courses/${courseId}/lessons`);
    return res.data.lessons ?? [];
  },

  async getLesson(courseId: string, id: string): Promise<Lesson> {
    const res = await apiClient.get<{ lesson: Lesson }>(`/courses/${courseId}/lessons/${id}`);
    return res.data.lesson;
  },

  async createLesson(courseId: string, data: CreateLessonPayload): Promise<Lesson> {
    const res = await apiClient.post<{ lesson: Lesson }>(`/courses/${courseId}/lessons`, data);
    return res.data.lesson;
  },

  async updateLesson(id: string, data: UpdateLessonPayload): Promise<Lesson> {
    const res = await apiClient.put<{ lesson: Lesson }>(`/lessons/${id}`, data);
    return res.data.lesson;
  },

  async publishLesson(id: string): Promise<void> {
    await apiClient.post(`/lessons/${id}/publish`);
  },

  async unpublishLesson(id: string): Promise<void> {
    await apiClient.post(`/lessons/${id}/unpublish`);
  },

  async deleteLesson(id: string): Promise<void> {
    await apiClient.delete(`/lessons/${id}`);
  },

  async reorderLessons(moduleId: string, lessons: Array<{ id: string; sort_order: number }>): Promise<void> {
    await apiClient.post(`/modules/${moduleId}/lessons/reorder`, { lessons });
  },

  async completeLesson(id: string): Promise<{ progress: LessonProgressData }> {
    const res = await apiClient.post<{ progress: LessonProgressData }>(`/lessons/${id}/complete`);
    return res.data;
  },

  async sendLessonEvents(id: string, events: VideoPlaybackEvent[]): Promise<{ progress: LessonProgressData }> {
    const res = await apiClient.post<{ progress: LessonProgressData }>(`/lessons/${id}/events`, { events });
    return res.data;
  },

  async getMyProgress(courseId?: string): Promise<Array<LessonProgressData & { lesson?: Lesson }>> {
    const res = await apiClient.get<{ progress: Array<LessonProgressData & { lesson?: Lesson }> }>('/me/progress', {
      params: courseId ? { course_id: courseId } : undefined,
    });
    return res.data.progress ?? [];
  },

  // --- Materials ---
  async createMaterial(lessonId: string, formData: FormData): Promise<LessonMaterial> {
    const res = await apiClient.post<{ material: LessonMaterial }>(`/lessons/${lessonId}/materials`, formData);
    return res.data.material;
  },

  async deleteMaterial(id: string): Promise<void> {
    await apiClient.delete(`/materials/${id}`);
  },

  getMaterialDownloadUrl(id: string): string {
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');
    return `${baseUrl}/materials/${id}/download`;
  },

  async getMyChildren(): Promise<Student[]> {
    const res = await apiClient.get<Student[]>('/me/children');
    return res.data ?? [];
  },

  // --- Students & Enrollment ---
  async getStudents(params?: { grade_level?: string; search?: string }): Promise<Student[]> {
    const res = await apiClient.get<{ students: Student[] }>('/students', { params });
    return res.data.students ?? [];
  },

  /**
   * One page of students (server-side search/filters). `analytics` rides along in the same request, so the list never
   * needs one dashboard call per student.
   */
  async getStudentsPage(params: {
    page: number;
    perPage?: number;
    search?: string;
    gradeLevel?: string;
    status?: string;
    withAnalytics?: boolean;
  }): Promise<{ items: Student[]; total: number; lastPage: number }> {
    const res = await apiClient.get<{ students: Student[] }>('/students', {
      params: {
        page: params.page,
        per_page: params.perPage ?? 20,
        search: params.search || undefined,
        grade_level: params.gradeLevel || undefined,
        status: params.status || undefined,
        include: params.withAnalytics ? 'analytics' : undefined,
      },
    });
    const p = res.meta.pagination;
    return { items: res.data.students ?? [], total: p?.total ?? 0, lastPage: p?.last_page ?? 1 };
  },

  async getStudent(id: string): Promise<Student> {
    const res = await apiClient.get<{ student: Student }>(`/students/${id}`);
    return res.data.student;
  },

  async enroll(courseId: string, studentId: string): Promise<void> {
    await apiClient.post(`/courses/${courseId}/enroll`, { student_id: studentId });
  },

  async getStudentAcademies(): Promise<{
    global_identity: { id?: string | null; name: string; email?: string | null; phone?: string | null };
    academies: Array<{
      tenant_id: string;
      name: string;
      slug: string;
      logo_url?: string | null;
      primary_color?: string | null;
      secondary_color?: string | null;
      brand_tagline?: string | null;
      is_current: boolean;
    }>;
  }> {
    const res = await apiClient.get<{
      global_identity: { id?: string | null; name: string; email?: string | null; phone?: string | null };
      academies: Array<{
        tenant_id: string;
        name: string;
        slug: string;
        logo_url?: string | null;
        primary_color?: string | null;
        secondary_color?: string | null;
        brand_tagline?: string | null;
        is_current: boolean;
      }>;
    }>('/student/academies');
    return res.data;
  },
};

export interface StaffPublicProfile {
  id: string;
  headline: string | null;
  public_bio: string | null;
  is_public: boolean;
  has_photo: boolean;
}

/** Teacher photo and opt-in public profile. */
export const staffProfileApi = {
  async get(staffId: string): Promise<StaffPublicProfile> {
    const res = await apiClient.get<{ profile: StaffPublicProfile }>(`/staff/${staffId}/public-profile`);
    return res.data.profile;
  },
  async update(staffId: string, data: { headline?: string | null; public_bio?: string | null; is_public?: boolean }): Promise<void> {
    await apiClient.put(`/staff/${staffId}/public-profile`, data);
  },
  async uploadPhoto(staffId: string, file: File): Promise<void> {
    const form = new FormData();
    form.append('image', file);
    await apiClient.post(`/staff/${staffId}/photo`, form);
  },
  async deletePhoto(staffId: string): Promise<void> {
    await apiClient.delete(`/staff/${staffId}/photo`);
  },
  photoBlob(staffId: string): Promise<Blob> {
    return apiClient.blob(`/staff/${staffId}/photo`);
  },
};
