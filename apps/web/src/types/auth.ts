/**
 * R1B — Auth Types
 * Canonical TypeScript types matching the /auth/me backend contract (AuthPayloadBuilder).
 * Source of truth: docs/backend/openapi.yaml + ADR-001-access-model.md
 *
 * DO NOT add fields here that do not exist in the backend contract.
 */

// ---------------------------------------------------------------------------
// Primitive types
// ---------------------------------------------------------------------------

export type Experience = 'admin' | 'staff' | 'student' | 'parent';

export type Persona = 'staff' | 'student' | 'parent';

/** Scope hierarchy: self < linked < own < assigned < branch < tenant */
export type PermissionScope =
  | 'self'
  | 'linked'
  | 'own'
  | 'assigned'
  | 'branch'
  | 'tenant';

/** Map of permission name -> granted scope level */
export type PermissionsMap = Record<string, PermissionScope>;

// ---------------------------------------------------------------------------
// Profile types
// ---------------------------------------------------------------------------

export interface StudentProfile {
  id: string;
  student_code: string;
  grade_level: string | null;
}

export interface StaffProfile {
  id: string;
  staff_type: 'teacher' | 'assistant' | 'admin' | string;
  branch_ids: string[];
}

export interface ParentProfileData {
  id: string;
}

export interface AuthProfiles {
  student: StudentProfile | null;
  staff: StaffProfile | null;
  parent: ParentProfileData | null;
}

// ---------------------------------------------------------------------------
// User type
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: 'active' | 'suspended' | string;
  roles: string[];
}

export interface AuthUserWithProfiles extends AuthUser {
  student?: StudentProfile | null;
  staff?: StaffProfile | null;
  parent?: ParentProfileData | null;
  type?: string;
}

export type UserRole = Experience;

// ---------------------------------------------------------------------------
// Tenant type
// ---------------------------------------------------------------------------

export interface AuthTenantBranding {
  logo_url: string | null;
  primary_color: string;
}

export interface AuthTenant {
  id: string;
  slug: string;
  name: string;
  type?: 'individual_teacher' | 'organization' | string;
  organization_kind?: 'center' | 'academy' | 'school' | 'institute' | string | null;
  city?: string | null;
  contact_phone?: string | null;
  services?: ('online' | 'offline' | string)[];
  modules: string[];
  auth_mode: 'password' | 'coupon' | 'hybrid' | string;
  branding: AuthTenantBranding;
}

// ---------------------------------------------------------------------------
// Role
// ---------------------------------------------------------------------------

export interface AuthRole {
  name: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Support session
// ---------------------------------------------------------------------------

export interface SupportSession {
  id: string;
  expires_at: string;
}

// ---------------------------------------------------------------------------
// The canonical auth session — returned by /auth/me
// ---------------------------------------------------------------------------

export interface AuthSession {
  user: AuthUser;
  persona: Persona;
  profiles: AuthProfiles;
  roles: AuthRole[];
  permissions: PermissionsMap;
  tenant: AuthTenant;
  experience: Experience;
  support_session: SupportSession | null;

  // Legacy compat aliases (backend emits these alongside the above)
  id: string;
  name: string;
  email: string;
  phone: string | null;
  type: string;
  status: string;
  profile: Record<string, unknown> | null;
}

