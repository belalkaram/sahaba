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

export interface DirectoryTeacher {
  id: number;
  staff_id: string;
  tenant_slug: string;
  tenant_name: string;
  name: string;
  headline: string | null;
  bio: string | null;
  photo_url: string | null;
  city: string | null;
  is_featured: boolean;
  academy_url: string;
}

export interface PublicPricing {
  student_monthly_fee: number;
  currency: string;
  teacher_fee: number;
  organization_fee: number;
  headline: string;
  receiving_account_type?: string;
  bank_name?: string | null;
  account_holder_name?: string | null;
  iban?: string | null;
  transfer_instructions?: string | null;
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

  async getDirectoryTeachers(featured?: boolean): Promise<DirectoryTeacher[]> {
    const query = featured ? '?featured=1' : '';
    const res = await apiClient.get<{ teachers: DirectoryTeacher[] }>(
      `/public/directory/teachers${query}`,
      { skipUnauthorizedHandler: true }
    );
    return res.data.teachers;
  },

  async getPricing(): Promise<PublicPricing> {
    const res = await apiClient.get<PublicPricing>('/public/pricing', { skipUnauthorizedHandler: true });
    return res.data;
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

export interface RegistrationOptions {
  regions: { value: string; label: string }[];
  stages: { value: string; label: string; grades: number }[];
  max_tenants: number;
}

export interface RegistrationAcademy {
  slug: string;
  name: string;
  type: 'individual_teacher' | 'organization' | string;
  organization_kind: string | null;
  city: string | null;
  tagline: string | null;
  logo_url: string | null;
}

export interface RegistrationPayload {
  full_name: string;
  national_id: string;
  region: string;
  governorate: string;
  address: string;
  education_stage: string;
  grade: number;
  student_phone: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_occupation?: string;
  email?: string;
  password: string;
  password_confirmation: string;
  tenants: string[];
  /** Honeypot: must stay empty. */
  website?: string;
}

export interface RegistrationResult {
  slug: string;
  name: string | null;
  status: 'submitted' | 'unavailable' | 'failed';
  reference_code: string | null;
}

/** Student self-registration (public, unauthenticated). */
export const registrationApi = {
  async options(): Promise<RegistrationOptions> {
    const res = await apiClient.get<RegistrationOptions>('/public/registration/options', { skipUnauthorizedHandler: true });
    return res.data;
  },
  async academies(q?: string): Promise<RegistrationAcademy[]> {
    const res = await apiClient.get<{ academies: RegistrationAcademy[] }>('/public/registration/academies', {
      params: { q },
      skipUnauthorizedHandler: true,
    });
    return res.data.academies;
  },
  async submit(payload: RegistrationPayload): Promise<RegistrationResult[]> {
    const res = await apiClient.post<{ results: RegistrationResult[] }>('/public/registration', payload, { skipUnauthorizedHandler: true });
    return res.data.results;
  },
};
