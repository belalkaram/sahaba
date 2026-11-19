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
  /** Public courses this teacher owns; null until the platform metrics job has run. */
  courses_count: number | null;
  is_featured: boolean;
  /** The teacher's own public page. */
  profile_url: string;
  /** The academy's public home. */
  academy_url: string;
}

/** An academy that opted into the public directory (`tenants.is_listed`). */
export interface DirectoryAcademy {
  slug: string;
  name: string;
  type: 'individual_teacher' | 'organization' | string;
  organization_kind: string | null;
  city: string | null;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string | null;
  services: ('online' | 'offline')[];
  /** null while the counts have not been computed yet — show nothing rather than a zero. */
  courses_count: number | null;
  teachers_count: number | null;
  accepts_registrations: boolean;
  is_featured: boolean;
  academy_url: string;
}

export interface DirectoryQuery {
  search?: string;
  city?: string;
  featured?: boolean;
  page?: number;
  per_page?: number;
  /** Academies only. */
  type?: 'individual_teacher' | 'organization';
  kind?: 'center' | 'academy' | 'school' | 'institute';
  service?: 'online' | 'offline';
  /** Teachers only: limit to one academy's slug. */
  academy?: string;
}

export interface Pagination {
  total: number;
  page: number;
  per_page: number;
  last_page: number;
}

/** Headline numbers for the landing page; a null count means "not computed", not zero. */
export interface PublicStats {
  academies_count: number;
  teachers_count: number;
  courses_count: number | null;
  cities_count: number;
  computed_at: string | null;
}

function directoryQuery(params: DirectoryQuery = {}): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '' || value === false) return;
    query.set(key, value === true ? '1' : String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

/** OD-39: students pay the platform nothing; academies buy seats (student = code). */
export interface PublicPricing {
  student_platform_fee: number;
  currency: string;
  capacity_model: 'seats' | string;
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

  async getDirectoryTeachers(params: DirectoryQuery | boolean = {}): Promise<DirectoryTeacher[]> {
    const query = typeof params === 'boolean' ? { featured: params } : params;
    const res = await apiClient.get<{ teachers: DirectoryTeacher[] }>(
      `/public/directory/teachers${directoryQuery(query)}`,
      { skipUnauthorizedHandler: true }
    );
    return res.data.teachers;
  },

  async getDirectoryAcademies(params: DirectoryQuery = {}): Promise<{ academies: DirectoryAcademy[]; pagination: Pagination }> {
    const res = await apiClient.get<{ academies: DirectoryAcademy[] }>(
      `/public/directory/academies${directoryQuery(params)}`,
      { skipUnauthorizedHandler: true }
    );
    const academies = res.data.academies ?? [];
    const pagination = res.meta.pagination ?? { total: academies.length, page: 1, per_page: academies.length, last_page: 1 };
    return { academies, pagination };
  },

  async getPublicStats(): Promise<PublicStats> {
    const res = await apiClient.get<PublicStats>('/public/stats', { skipUnauthorizedHandler: true });
    return res.data;
  },

  async getPricing(): Promise<PublicPricing> {
    const res = await apiClient.get<PublicPricing>('/public/pricing', { skipUnauthorizedHandler: true });
    return res.data;
  },
};

/** Landing page customisation data returned by GET /public/academy/profile (TL-1, ADR-007). */
export interface TenantLandingPublic {
  schema: number;
  template: 'oasis' | 'beacon' | 'breeze' | 'atlas' | 'horizon';
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    surface: string;
  };
  sections: {
    stats?: boolean;
    courses?: boolean;
    teachers?: boolean;
    about?: boolean;
    contact?: boolean;
    faq?: boolean;
  };
  content?: {
    cover_path?: string | null;
    about?: { text?: string | null; highlights?: string[] };
    faq?: Array<{ question: string; answer: string }>;
    contact?: {
      phone?: string | null;
      whatsapp?: string | null;
      email?: string | null;
      address?: string | null;
      map_url?: string | null;
    } | null;
  };
}

/** What an academy publishes about itself (GET /public/academy/profile). */
export interface AcademyProfile {
  slug: string;
  name: string;
  type: 'individual_teacher' | 'organization' | string;
  organization_kind: string | null;
  city: string | null;
  brand_tagline: string | null;
  logo_url: string | null;
  primary_color: string | null;
  services: ('online' | 'offline')[];
  accepts_registrations: boolean;
  is_listed: boolean;
  /** Published landing page settings — null when the academy has not published any yet. */
  landing?: TenantLandingPublic | null;
}

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
  /** Marketing profile only — /tenant/current also carries operational fields. */
  async academy(slug: string, previewToken?: string): Promise<AcademyProfile> {
    const res = await apiClient.get<AcademyProfile>(
      '/public/academy/profile',
      // A valid preview token makes the API return the unpublished draft (TL-5, ADR-007).
      { ...opts(slug), params: previewToken ? { preview: previewToken } : undefined },
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
  /** Applicant checks one request: academy code + reference + the student's mobile. 404 = no match (never says which part). */
  async status(params: { tenant: string; reference: string; phone: string }): Promise<RegistrationRequestStatus> {
    const res = await apiClient.get<{ status: RegistrationRequestStatus }>('/public/registration/status', {
      params,
      skipUnauthorizedHandler: true,
    });
    return res.data.status;
  },
};

export type RegistrationRequestStatus = 'pending' | 'approved' | 'rejected';

/** Where a student signs in to one academy (the academy code is prefilled). */
export function academyLoginHref(slug: string): string {
  return `/login?tenant=${encodeURIComponent(slug)}`;
}

/** Status page for one request, prefilled with the academy code and the reference. */
export function registrationStatusHref(slug: string, reference: string): string {
  return `/register/status?tenant=${encodeURIComponent(slug)}&ref=${encodeURIComponent(reference)}`;
}
