/**
 * R1B â€” Navigation Registry
 * Single source of truth for all sidebar navigation items across experiences.
 *
 * Each NavItem declares:
 *   - experience: which experience(s) can see this item
 *   - module?: item only shown if tenant.modules includes this module name
 *   - anyOf?: item only shown if user has at least one of these permissions
 *
 * Layouts filter this registry by experience + module + permission.
 * The backend is the security boundary; this controls UI visibility only.
 */

import type { Experience, PermissionsMap } from '../types/auth';

// ---------------------------------------------------------------------------
// NavItem shape
// ---------------------------------------------------------------------------

export type NavGroup = 'home' | 'learning' | 'teaching' | 'finance' | 'management' | 'account' | 'platform';

/** Sidebar group headings, in display order. */
export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  home: 'Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©',
  learning: 'Ø§Ù„ØªØ¹Ù„Ù‘Ù…',
  teaching: 'Ø§Ù„ØªØ¹Ù„ÙŠÙ… ÙˆØ§Ù„Ù…ØªØ§Ø¨Ø¹Ø©',
  finance: 'Ø§Ù„Ù…Ø§Ù„ÙŠØ© ÙˆØ§Ù„Ø§Ø´ØªØ±Ø§ÙƒØ§Øª',
  management: 'Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø¤Ø³Ø³Ø©',
  account: 'Ø­Ø³Ø§Ø¨ÙŠ',
  platform: 'Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ù†ØµØ©',
};

export interface NavItem {
  id: string;
  href: string;
  label: string;
  /** Key into config/nav-icons.ts (Lucide icon). */
  iconName: string;
  experience: Experience | Experience[];
  group: NavGroup;
  /** Platform-console items only appear in the platform area, never in a tenant's sidebar. */
  area?: 'platform';
  /** Shown in the mobile bottom bar (max 4 per experience). */
  primary?: boolean;
  /** Optional: tenant module key that must be in tenant.modules */
  module?: string;
  /** Optional: at least one of these permissions must be in user's PermissionsMap */
  anyOf?: string[];
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const NAVIGATION_REGISTRY: NavItem[] = [
  // Tenant admin (OD-19: own dashboard) & staff
  { id: 'admin-dashboard', href: '/admin', label: 'Ù„ÙˆØ­Ø© Ø§Ù„Ù…Ø¤Ø³Ø³Ø©', iconName: 'dashboard', experience: 'admin', group: 'home', primary: true },
  { id: 'staff-dashboard', href: '/teacher/dashboard', label: 'Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ…', iconName: 'dashboard', experience: 'staff', group: 'home', primary: true },
  { id: 'admin-courses', href: '/teacher/courses', label: 'Ø§Ù„Ù…Ù‚Ø±Ø±Ø§Øª ÙˆØ§Ù„Ø¯Ø±ÙˆØ³', iconName: 'courses', experience: ['admin', 'staff'], group: 'teaching', primary: true, module: 'online', anyOf: ['courses.view', 'courses.create'] },
  { id: 'admin-students', href: '/teacher/students', label: 'Ø³Ø¬Ù„ Ø§Ù„Ø·Ù„Ø§Ø¨', iconName: 'students', experience: ['admin', 'staff'], group: 'teaching', primary: true, anyOf: ['students.view'] },
  { id: 'admin-attendance', href: '/teacher/attendance', label: 'Ø§Ù„Ø­ØµØµ ÙˆØ§Ù„Ø­Ø¶ÙˆØ±', iconName: 'attendance', experience: ['admin', 'staff'], group: 'teaching', primary: true, module: 'offline', anyOf: ['attendance.view', 'attendance.scan'] },
  { id: 'staff-classes', href: '/teacher/classes', label: 'Ø§Ù„Ø´ÙÙ‘Ø¹Ø¨ Ø§Ù„Ø¯Ø±Ø§Ø³ÙŠØ©', iconName: 'classes', experience: ['admin', 'staff'], group: 'teaching', module: 'offline', anyOf: ['classes.view'] },
  { id: 'staff-sessions', href: '/teacher/sessions', label: 'Ø§Ù„Ø­ØµØµ', iconName: 'sessions', experience: ['admin', 'staff'], group: 'teaching', module: 'offline', anyOf: ['sessions.view'] },
  { id: 'staff-assessments', href: '/teacher/assessments', label: 'Ø§Ù„ÙˆØ§Ø¬Ø¨Ø§Øª ÙˆØ§Ù„Ø§Ø®ØªØ¨Ø§Ø±Ø§Øª', iconName: 'assignments', experience: ['admin', 'staff'], group: 'teaching', module: 'assessment', anyOf: ['assignments.view', 'exams.view', 'assignments.create', 'exams.create'] },
  { id: 'staff-grading', href: '/teacher/grading', label: 'Ø§Ù„ØªØµØ­ÙŠØ­', iconName: 'grading', experience: ['admin', 'staff'], group: 'teaching', module: 'assessment', anyOf: ['assignments.grade', 'exams.grade'] },
  { id: 'staff-meetings', href: '/teacher/meetings', label: 'Ø§Ù„Ø­ØµØµ Ø§Ù„Ù…Ø¨Ø§Ø´Ø±Ø©', iconName: 'meetings', experience: ['admin', 'staff'], group: 'teaching', module: 'online', anyOf: ['meetings.view', 'meetings.create'] },
  { id: 'staff-media', href: '/teacher/media', label: 'Ù…ÙƒØªØ¨Ø© Ø§Ù„ÙˆØ³Ø§Ø¦Ø·', iconName: 'media', experience: ['admin', 'staff'], group: 'teaching', module: 'online', anyOf: ['media.view', 'media.upload'] },
  { id: 'staff-analytics', href: '/teacher/analytics', label: 'Ø§Ù„ØªØ­Ù„ÙŠÙ„Ø§Øª', iconName: 'analytics', experience: ['admin', 'staff'], group: 'teaching', module: 'analytics', anyOf: ['analytics.view'] },
  { id: 'staff-reports', href: '/teacher/reports', label: 'Ø§Ù„ØªÙ‚Ø§Ø±ÙŠØ±', iconName: 'reports', experience: 'staff', group: 'teaching', module: 'analytics', anyOf: ['reports.generate', 'reports.view'] },
  { id: 'admin-assistant', href: '/teacher/assistant', label: 'Ù…Ù‡Ø§Ù… Ø§Ù„Ù…Ø³Ø§Ø¹Ø¯ Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠ', iconName: 'tasks', experience: ['admin', 'staff'], group: 'teaching' },
  { id: 'admin-payments', href: '/teacher/payments', label: 'Ù…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø§Øª', iconName: 'receipts', experience: ['admin', 'staff'], group: 'finance', module: 'billing', anyOf: ['payments.view', 'payments.approve', 'payments.reject', 'billing.view'] },
  { id: 'admin-packages', href: '/admin/packages', label: 'Ø§Ù„Ø¨Ø§Ù‚Ø§Øª ÙˆØ§Ù„Ø£Ø³Ø¹Ø§Ø±', iconName: 'packages', experience: 'admin', group: 'finance', module: 'billing', anyOf: ['packages.view', 'packages.manage', 'billing.view'] },
  { id: 'admin-credentials', href: '/teacher/credentials', label: 'Ø£ÙƒÙˆØ§Ø¯ Ø§Ù„Ø¯Ø®ÙˆÙ„ ÙˆØ§Ù„Ø£Ø¬Ù‡Ø²Ø©', iconName: 'credentials', experience: ['admin', 'staff'], group: 'management', module: 'credentials', anyOf: ['credentials.view'] },
  { id: 'admin-users', href: '/admin/users', label: 'Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙˆÙ†', iconName: 'users', experience: 'admin', group: 'management', anyOf: ['users.view', 'students.view', 'staff.manage'] },
  { id: 'admin-roles', href: '/admin/roles', label: 'Ø§Ù„Ø£Ø¯ÙˆØ§Ø± ÙˆØ§Ù„ØµÙ„Ø§Ø­ÙŠØ§Øª', iconName: 'roles', experience: 'admin', group: 'management', anyOf: ['roles.view', 'roles.create'] },
  { id: 'admin-branches', href: '/admin/branches', label: 'Ø§Ù„ÙØ±ÙˆØ¹ ÙˆØ§Ù„Ù‚Ø§Ø¹Ø§Øª', iconName: 'branches', experience: 'admin', group: 'management', module: 'offline', anyOf: ['branches.manage'] },
  { id: 'admin-reports', href: '/admin/reports', label: 'Ø§Ù„ØªÙ‚Ø§Ø±ÙŠØ±', iconName: 'reports', experience: 'admin', group: 'management', module: 'analytics', anyOf: ['reports.generate', 'reports.view'] },
  { id: 'admin-academic-settings', href: '/admin/academic-settings', label: 'Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ø£ÙƒØ§Ø¯ÙŠÙ…ÙŠØ©', iconName: 'tasks', experience: 'admin', group: 'management', anyOf: ['tenant.settings'] },
  { id: 'admin-audit', href: '/admin/audit', label: 'Ø³Ø¬Ù„ Ø§Ù„ØªØ¯Ù‚ÙŠÙ‚', iconName: 'audit', experience: 'admin', group: 'management', anyOf: ['audit.view'] },
  { id: 'admin-integrations', href: '/admin/integrations', label: 'Ø§Ù„ØªÙƒØ§Ù…Ù„Ø§Øª', iconName: 'integrations', experience: 'admin', group: 'management', anyOf: ['tenant.settings', 'roles.view'] },
  { id: 'admin-settings', href: '/admin/settings', label: 'Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…Ø¤Ø³Ø³Ø©', iconName: 'settings', experience: 'admin', group: 'management', anyOf: ['tenant.settings', 'tenant.branding', 'roles.view'] },

  // Student
  { id: 'student-dashboard', href: '/student/dashboard', label: 'Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©', iconName: 'home', experience: 'student', group: 'home', primary: true },
  { id: 'student-courses', href: '/student/courses', label: 'Ù…ÙˆØ§Ø¯ÙŠ Ø§Ù„Ø¯Ø±Ø§Ø³ÙŠØ©', iconName: 'courses', experience: 'student', group: 'learning', primary: true, module: 'online' },
  { id: 'student-assignments', href: '/student/assignments', label: 'ÙˆØ§Ø¬Ø¨Ø§ØªÙŠ', iconName: 'assignments', experience: 'student', group: 'learning', module: 'assessment' },
  { id: 'student-exams', href: '/student/exams', label: 'Ø§Ø®ØªØ¨Ø§Ø±Ø§ØªÙŠ', iconName: 'exams', experience: 'student', group: 'learning', primary: true, module: 'assessment' },
  { id: 'student-meetings', href: '/student/meetings', label: 'Ø§Ù„Ø­ØµØµ Ø§Ù„Ù…Ø¨Ø§Ø´Ø±Ø©', iconName: 'meetings', experience: 'student', group: 'learning', module: 'online' },
  { id: 'student-attendance', href: '/student/attendance', label: 'Ø³Ø¬Ù„ Ø§Ù„Ø­Ø¶ÙˆØ±', iconName: 'attendance', experience: 'student', group: 'learning', module: 'offline' },
  { id: 'student-grades', href: '/student/grades', label: 'Ø¯Ø±Ø¬Ø§ØªÙŠ ÙˆØ´Ù‡Ø§Ø¯Ø§ØªÙŠ', iconName: 'grades', experience: 'student', group: 'learning' },
  { id: 'student-plans', href: '/student/plans', label: 'Ø¨Ø§Ù‚Ø§Øª Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ', iconName: 'packages', experience: 'student', group: 'finance', module: 'billing' },
  { id: 'student-subscriptions', href: '/student/subscriptions', label: 'Ø§Ø´ØªØ±Ø§ÙƒØ§ØªÙŠ', iconName: 'subscriptions', experience: 'student', group: 'finance', module: 'billing' },
  { id: 'student-payments', href: '/student/payments', label: 'Ø³Ø¬Ù„ Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø§Øª', iconName: 'wallet', experience: 'student', group: 'finance', module: 'billing' },
  { id: 'staff-profile', href: '/teacher/profile', label: 'Ù…Ù„ÙÙŠ Ø§Ù„Ø¹Ø§Ù…', iconName: 'profile', experience: 'staff', group: 'account' },
  { id: 'student-card', href: '/student/card', label: 'Ø¨Ø·Ø§Ù‚ØªÙŠ Ø§Ù„Ø±Ù‚Ù…ÙŠØ©', iconName: 'card', experience: 'student', group: 'account', primary: true, module: 'offline' },
  { id: 'student-profile', href: '/student/profile', label: 'Ø§Ù„Ù…Ù„Ù Ø§Ù„Ø´Ø®ØµÙŠ ÙˆØ§Ù„Ø£Ø¬Ù‡Ø²Ø©', iconName: 'profile', experience: 'student', group: 'account' },

  // Parent
  { id: 'parent-dashboard', href: '/parent/dashboard', label: 'Ù…Ù„Ø®Øµ Ø§Ù„Ø£Ø¨Ù†Ø§Ø¡', iconName: 'home', experience: 'parent', group: 'home', primary: true },
  { id: 'parent-children', href: '/parent/children', label: 'Ø§Ù„Ù…Ù„Ù Ø§Ù„Ø£ÙƒØ§Ø¯ÙŠÙ…ÙŠ ÙˆØ§Ù„Ø¯Ø±Ø¬Ø§Øª', iconName: 'grades', experience: 'parent', group: 'learning', primary: true },

  { id: 'parent-reports', href: '/parent/reports', label: 'ØªÙ‚Ø§Ø±ÙŠØ± Ø§Ù„Ø£Ø¨Ù†Ø§Ø¡', iconName: 'reports', experience: 'parent', group: 'learning', module: 'analytics' },

  // Platform console (only inside /platform)
  { id: 'platform-dashboard', href: '/platform/dashboard', label: 'Ù†Ø¸Ø±Ø© Ø¹Ø§Ù…Ø©', iconName: 'dashboard', experience: 'admin', group: 'platform', area: 'platform', primary: true },
  { id: 'platform-tenants', href: '/platform/tenants', label: 'Ø§Ù„Ù…Ø¤Ø³Ø³Ø§Øª Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©', iconName: 'branches', experience: 'admin', group: 'platform', area: 'platform', primary: true },
  { id: 'platform-support-sessions', href: '/platform/support-sessions', label: 'Ø¬Ù„Ø³Ø§Øª Ø§Ù„Ø¯Ø¹Ù… Ø§Ù„ÙÙ†ÙŠ', iconName: 'support', experience: 'admin', group: 'platform', area: 'platform', primary: true },
  { id: 'platform-audit', href: '/platform/audit', label: 'Ø³Ø¬Ù„ Ø§Ù„ØªØ¯Ù‚ÙŠÙ‚ Ø§Ù„Ø¹Ø§Ù…', iconName: 'audit', experience: 'admin', group: 'platform', area: 'platform' },
  { id: 'platform-settings', href: '/platform/settings', label: 'Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…Ù†ØµØ© ÙˆØ§Ù„Ø±Ø³Ø§Ø¦Ù„', iconName: 'settings', experience: 'admin', group: 'platform', area: 'platform', primary: true },
];

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

function experienceMatches(
  itemExperience: Experience | Experience[],
  userExperience: Experience
): boolean {
  if (Array.isArray(itemExperience)) {
    return itemExperience.includes(userExperience);
  }
  return itemExperience === userExperience;
}

/**
 * Filter the navigation registry for a given user context.
 *
 * @param experience - The user's computed experience from the backend
 * @param modules - List of enabled module keys from tenant.modules
 * @param permissions - The user's permissions map from the backend
 * @param area - 'platform' inside /platform, otherwise 'tenant'
 */
export function filterNavItems(
  experience: Experience,
  modules: string[],
  permissions: PermissionsMap,
  area: 'tenant' | 'platform' = 'tenant',
  tenantType?: string,
  services?: string[],
  userMode?: 'online' | 'offline' | 'both'
): NavItem[] {
  const isIndividualTeacher = tenantType === 'individual_teacher';

  return NAVIGATION_REGISTRY.filter((item) => {
    // Platform-console items live only in the platform area (and vice versa)
    if ((item.area === 'platform') !== (area === 'platform')) return false;

    // Must match experience
    if (!experienceMatches(item.experience, experience)) return false;

    // OD-24: Independent teacher UI is simplified (no complex roles management)
    if (isIndividualTeacher && item.id === 'admin-roles') return false;

    // OD-32: Offline student account is follow-up only (attendance, card, grades, payments, no online courses/exams)
    if (experience === 'student' && userMode === 'offline') {
      const isOnlineOnly = ['student-courses', 'student-meetings', 'student-exams', 'student-assignments'].includes(item.id);
      if (isOnlineOnly) return false;
    }

    // If module restriction, tenant must have it
    if (item.module && !modules.includes(item.module)) return false;

    // OD-31: If explicit services list provided, filter items by service domain
    if (services && services.length > 0) {
      const isOnlineModule = ['courses', 'meetings', 'media', 'online'].includes(item.module ?? '');
      const isOfflineModule = ['attendance', 'classes', 'sessions', 'offline', 'credentials'].includes(item.module ?? '');

      if (isOnlineModule && !services.includes('online')) return false;
      if (isOfflineModule && !services.includes('offline')) return false;
    }

    // If permission restriction, user must have at least one
    if (item.anyOf && item.anyOf.length > 0) {
      const hasAny = item.anyOf.some((p) => p in permissions);
      if (!hasAny) return false;
    }

    return true;
  }).map((item) => {
    // OD-24: For individual teacher, rename "Ø§Ù„ÙØ±ÙˆØ¹ ÙˆØ§Ù„Ù‚Ø§Ø¹Ø§Øª" to "Ø£Ù…Ø§ÙƒÙ† Ø§Ù„ØªØ¯Ø±ÙŠØ³ ÙˆØ§Ù„Ù‚Ø§Ø¹Ø§Øª"
    if (isIndividualTeacher && item.id === 'admin-branches') {
      return { ...item, label: 'Ø£Ù…Ø§ÙƒÙ† Ø§Ù„ØªØ¯Ø±ÙŠØ³ ÙˆØ§Ù„Ù‚Ø§Ø¹Ø§Øª' };
    }
    return item;
  });
}

