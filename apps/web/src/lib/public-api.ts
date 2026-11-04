import { apiClient } from './api-client';

export interface PublicConfig {
  demo_login_enabled: boolean;
}

export interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  institution?: string;
  message: string;
}

/** Unauthenticated endpoints used by public pages. */
export const publicApi = {
  async getConfig(): Promise<PublicConfig> {
    const res = await apiClient.get<PublicConfig>('/public/config', { skipUnauthorizedHandler: true });
    return res.data;
  },

  async sendContactMessage(payload: ContactPayload): Promise<void> {
    await apiClient.post('/public/contact', payload, { skipUnauthorizedHandler: true });
  },
};

export interface PublicTeacherRef {
  id: string;
  name: string;
}

export interface PublicCourse {
  id: string;
  title: string;
  level: string | null;
  is_free: boolean;
  summary: string;
  image_url: string | null;
  teacher: PublicTeacherRef | null;
  description?: string | null;
  modules?: { title: string }[];
  lesson_count?: number;
}

export interface PublicTeacher {
  id: string;
  name: string;
  headline: string | null;
  image_url: string | null;
  courses_count: number;
  bio?: string | null;
  courses?: PublicCourse[];
}

const opts = (slug: string) => ({ tenant: slug, token: '', skipUnauthorizedHandler: true });

/** Academy landing data (opt-in content only). Tenant comes from the page's slug, never from a session. */
export const publicAcademyApi = {
  async courses(slug: string): Promise<PublicCourse[]> {
    const res = await apiClient.get<{ courses: PublicCourse[] }>('/public/academy/courses', opts(slug));
    return res.data.courses;
  },
  async course(slug: string, id: string): Promise<PublicCourse> {
    const res = await apiClient.get<{ course: PublicCourse }>(`/public/academy/courses/${id}`, opts(slug));
    return res.data.course;
  },
  async teachers(slug: string): Promise<PublicTeacher[]> {
    const res = await apiClient.get<{ teachers: PublicTeacher[] }>('/public/academy/teachers', opts(slug));
    return res.data.teachers;
  },
  async teacher(slug: string, id: string): Promise<PublicTeacher> {
    const res = await apiClient.get<{ teacher: PublicTeacher }>(`/public/academy/teachers/${id}`, opts(slug));
    return res.data.teacher;
  },
  async academy(slug: string) {
    const res = await apiClient.get<{ name: string; slug: string; logo_url: string | null; primary_color: string | null; brand_tagline: string | null }>(
      '/tenant/current',
      opts(slug),
    );
    return res.data;
  },
  /** Absolute image URL (server adds ?tenant= so a bare <img> can load it). */
  imageSrc(path: string | null): string | null {
    return path ? apiClient.url(path) : null;
  },
};
