/**
 * R1B — Navigation Registry
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
  home: 'الرئيسية',
  learning: 'التعلّم',
  teaching: 'التعليم والمتابعة',
  finance: 'المالية والاشتراكات',
  management: 'إدارة المؤسسة',
  account: 'حسابي',
  platform: 'إدارة المنصة',
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
  { id: 'admin-dashboard', href: '/admin', label: 'لوحة المؤسسة', iconName: 'dashboard', experience: 'admin', group: 'home', primary: true },
  { id: 'staff-dashboard', href: '/teacher/dashboard', label: 'لوحة التحكم', iconName: 'dashboard', experience: 'staff', group: 'home', primary: true },
  { id: 'admin-courses', href: '/teacher/courses', label: 'المقررات والدروس', iconName: 'courses', experience: ['admin', 'staff'], group: 'teaching', primary: true, module: 'online', anyOf: ['courses.view', 'courses.create'] },
  { id: 'admin-students', href: '/teacher/students', label: 'سجل الطلاب', iconName: 'students', experience: ['admin', 'staff'], group: 'teaching', primary: true, anyOf: ['students.view'] },
  { id: 'admin-attendance', href: '/teacher/attendance', label: 'الحصص والحضور', iconName: 'attendance', experience: ['admin', 'staff'], group: 'teaching', primary: true, module: 'offline', anyOf: ['attendance.view', 'attendance.scan'] },
  { id: 'staff-classes', href: '/teacher/classes', label: 'الشُّعب الدراسية', iconName: 'classes', experience: ['admin', 'staff'], group: 'teaching', module: 'offline', anyOf: ['classes.view'] },
  { id: 'staff-sessions', href: '/teacher/sessions', label: 'الحصص', iconName: 'sessions', experience: ['admin', 'staff'], group: 'teaching', module: 'offline', anyOf: ['sessions.view'] },
  { id: 'staff-exams', href: '/teacher/exams', label: 'الاختبارات', iconName: 'exams', experience: ['admin', 'staff'], group: 'teaching', module: 'assessment', anyOf: ['exams.view', 'exams.create'] },
  { id: 'staff-assignments', href: '/teacher/assignments', label: 'الواجبات', iconName: 'assignments', experience: ['admin', 'staff'], group: 'teaching', module: 'assessment', anyOf: ['assignments.view', 'assignments.create'] },
  { id: 'staff-grading', href: '/teacher/grading', label: 'التصحيح', iconName: 'grading', experience: ['admin', 'staff'], group: 'teaching', module: 'assessment', anyOf: ['assignments.grade', 'exams.grade'] },
  { id: 'staff-meetings', href: '/teacher/meetings', label: 'الحصص المباشرة', iconName: 'meetings', experience: ['admin', 'staff'], group: 'teaching', module: 'online', anyOf: ['meetings.view', 'meetings.create'] },
  { id: 'staff-media', href: '/teacher/media', label: 'مكتبة الوسائط', iconName: 'media', experience: ['admin', 'staff'], group: 'teaching', module: 'online', anyOf: ['media.view', 'media.upload'] },
  { id: 'staff-analytics', href: '/teacher/analytics', label: 'التحليلات', iconName: 'analytics', experience: ['admin', 'staff'], group: 'teaching', module: 'analytics', anyOf: ['analytics.view'] },
  { id: 'staff-reports', href: '/teacher/reports', label: 'التقارير', iconName: 'reports', experience: 'staff', group: 'teaching', module: 'analytics', anyOf: ['reports.generate', 'reports.view'] },
  { id: 'admin-assistant', href: '/teacher/assistant', label: 'مهام المساعد التعليمي', iconName: 'tasks', experience: ['admin', 'staff'], group: 'teaching' },
  { id: 'admin-payments', href: '/teacher/payments', label: 'مراجعة المدفوعات', iconName: 'receipts', experience: ['admin', 'staff'], group: 'finance', module: 'billing', anyOf: ['payments.view', 'payments.approve', 'payments.reject', 'billing.view'] },
  { id: 'admin-packages', href: '/admin/packages', label: 'الباقات والأسعار', iconName: 'packages', experience: 'admin', group: 'finance', module: 'billing', anyOf: ['packages.view', 'packages.manage', 'billing.view'] },
  { id: 'admin-credentials', href: '/teacher/credentials', label: 'أكواد الدخول والأجهزة', iconName: 'credentials', experience: ['admin', 'staff'], group: 'management', module: 'credentials', anyOf: ['credentials.view'] },
  { id: 'admin-users', href: '/admin/users', label: 'المستخدمون', iconName: 'users', experience: 'admin', group: 'management', anyOf: ['users.view', 'students.view', 'staff.manage'] },
  { id: 'admin-roles', href: '/admin/roles', label: 'الأدوار والصلاحيات', iconName: 'roles', experience: 'admin', group: 'management', anyOf: ['roles.view', 'roles.create'] },
  { id: 'admin-branches', href: '/admin/branches', label: 'الفروع والقاعات', iconName: 'branches', experience: 'admin', group: 'management', module: 'offline', anyOf: ['branches.manage'] },
  { id: 'admin-reports', href: '/admin/reports', label: 'التقارير', iconName: 'reports', experience: 'admin', group: 'management', module: 'analytics', anyOf: ['reports.generate', 'reports.view'] },
  { id: 'admin-academic-settings', href: '/admin/academic-settings', label: 'الإعدادات الأكاديمية', iconName: 'tasks', experience: 'admin', group: 'management', anyOf: ['tenant.settings'] },
  { id: 'admin-audit', href: '/admin/audit', label: 'سجل التدقيق', iconName: 'audit', experience: 'admin', group: 'management', anyOf: ['audit.view'] },
  { id: 'admin-integrations', href: '/admin/integrations', label: 'التكاملات', iconName: 'integrations', experience: 'admin', group: 'management', anyOf: ['tenant.settings', 'roles.view'] },
  { id: 'admin-settings', href: '/admin/settings', label: 'إعدادات المؤسسة', iconName: 'settings', experience: 'admin', group: 'management', anyOf: ['tenant.settings', 'tenant.branding', 'roles.view'] },

  // Student
  { id: 'student-dashboard', href: '/student/dashboard', label: 'الرئيسية', iconName: 'home', experience: 'student', group: 'home', primary: true },
  { id: 'student-courses', href: '/student/courses', label: 'موادي الدراسية', iconName: 'courses', experience: 'student', group: 'learning', primary: true, module: 'online' },
  { id: 'student-assignments', href: '/student/assignments', label: 'واجباتي', iconName: 'assignments', experience: 'student', group: 'learning', module: 'assessment' },
  { id: 'student-exams', href: '/student/exams', label: 'اختباراتي', iconName: 'exams', experience: 'student', group: 'learning', primary: true, module: 'assessment' },
  { id: 'student-meetings', href: '/student/meetings', label: 'الحصص المباشرة', iconName: 'meetings', experience: 'student', group: 'learning', module: 'online' },
  { id: 'student-attendance', href: '/student/attendance', label: 'سجل الحضور', iconName: 'attendance', experience: 'student', group: 'learning', module: 'offline' },
  { id: 'student-grades', href: '/student/grades', label: 'درجاتي وشهاداتي', iconName: 'grades', experience: 'student', group: 'learning' },
  { id: 'student-plans', href: '/student/plans', label: 'باقات الاشتراك', iconName: 'packages', experience: 'student', group: 'finance', module: 'billing' },
  { id: 'student-subscriptions', href: '/student/subscriptions', label: 'اشتراكاتي', iconName: 'subscriptions', experience: 'student', group: 'finance', module: 'billing' },
  { id: 'student-payments', href: '/student/payments', label: 'سجل المدفوعات', iconName: 'wallet', experience: 'student', group: 'finance', module: 'billing' },
  { id: 'registrations', href: '/teacher/registrations', label: 'طلبات التسجيل', iconName: 'students', experience: ['admin', 'staff'], group: 'teaching', anyOf: ['students.create'] },
  { id: 'staff-profile', href: '/teacher/profile', label: 'ملفي العام', iconName: 'profile', experience: 'staff', group: 'account' },
  { id: 'student-card', href: '/student/card', label: 'بطاقتي الرقمية', iconName: 'card', experience: 'student', group: 'account', primary: true, module: 'offline' },
  { id: 'student-profile', href: '/student/profile', label: 'الملف الشخصي والأجهزة', iconName: 'profile', experience: 'student', group: 'account' },

  // Parent
  { id: 'parent-dashboard', href: '/parent/dashboard', label: 'ملخص الأبناء', iconName: 'home', experience: 'parent', group: 'home', primary: true },
  { id: 'parent-children', href: '/parent/children', label: 'الملف الأكاديمي والدرجات', iconName: 'grades', experience: 'parent', group: 'learning', primary: true },
  { id: 'parent-reports', href: '/parent/reports', label: 'تقارير الأبناء', iconName: 'reports', experience: 'parent', group: 'learning', module: 'analytics' },

  // Platform console (only inside /platform)
  { id: 'platform-dashboard', href: '/platform/dashboard', label: 'نظرة عامة', iconName: 'dashboard', experience: 'admin', group: 'platform', area: 'platform', primary: true },
  { id: 'platform-tenants', href: '/platform/tenants', label: 'المؤسسات التعليمية', iconName: 'branches', experience: 'admin', group: 'platform', area: 'platform', primary: true },
  { id: 'platform-payments', href: '/platform/payments', label: 'مراجعة المدفوعات', iconName: 'finance', experience: 'admin', group: 'platform', area: 'platform', primary: true },
  { id: 'platform-support-sessions', href: '/platform/support-sessions', label: 'جلسات الدعم الفني', iconName: 'support', experience: 'admin', group: 'platform', area: 'platform', primary: true },
  { id: 'platform-audit', href: '/platform/audit', label: 'سجل التدقيق العام', iconName: 'audit', experience: 'admin', group: 'platform', area: 'platform' },
  { id: 'platform-settings', href: '/platform/settings', label: 'إعدادات المنصة والرسائل', iconName: 'settings', experience: 'admin', group: 'platform', area: 'platform', primary: true },
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
    // OD-24: For individual teacher, rename "الفروع والقاعات" to "أماكن التدريس والقاعات"
    if (isIndividualTeacher && item.id === 'admin-branches') {
      return { ...item, label: 'أماكن التدريس والقاعات' };
    }
    return item;
  });
}
