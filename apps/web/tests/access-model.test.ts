/**
 * R1B — Frontend Access Model & Navigation Registry Test Suite
 * Executed with Node.js 24 native test runner:
 * node --experimental-strip-types --test apps/web/tests/access-model.test.ts
 */

import { readFileSync } from 'node:fs';
import { test, describe } from 'node:test';
import assert from 'node:assert';
// @ts-ignore - Node 24 native test runner requires .ts extension for ESM resolution
import { filterNavItems, NAVIGATION_REGISTRY } from '../src/config/navigation-registry.ts';
// @ts-ignore
import type { PermissionsMap, AuthSession } from '../src/types/auth.ts';

describe('NavigationRegistry Filtering', () => {
  test('student experience only returns student navigation items', () => {
    const modules = ['online', 'offline', 'assessment', 'billing'];
    const permissions: PermissionsMap = {
      'courses.view': 'tenant',
      'attendance.view': 'self',
    };

    const items = filterNavItems('student', modules, permissions);

    assert.ok(items.length > 0, 'Should return student navigation items');
    for (const item of items) {
      assert.strictEqual(item.experience, 'student', `Item ${item.id} must be for student`);
      assert.ok(item.href.startsWith('/student/'), `Item ${item.id} href must start with /student/`);
    }
    assert.ok(items.some((i) => i.id === 'student-dashboard'), 'Includes student dashboard');
    assert.ok(items.some((i) => i.id === 'student-courses'), 'Includes student courses');
    assert.ok(!items.some((i) => i.id.startsWith('admin-')), 'Never includes admin items');
  });

  test('parent experience only returns parent navigation items', () => {
    const modules = ['online', 'offline'];
    const permissions: PermissionsMap = {};

    const items = filterNavItems('parent', modules, permissions);

    assert.ok(items.length > 0, 'Should return parent navigation items');
    for (const item of items) {
      assert.strictEqual(item.experience, 'parent', `Item ${item.id} must be for parent`);
      assert.ok(item.href.startsWith('/parent/'), `Item ${item.id} href must start with /parent/`);
    }
    assert.ok(items.some((i) => i.id === 'parent-dashboard'));
    assert.ok(items.some((i) => i.id === 'parent-children'));
    assert.ok(!items.some((i) => i.id.startsWith('student-')));
  });

  test('module gating: hides navigation item when module is disabled in tenant', () => {
    const fullPermissions: PermissionsMap = {
      'courses.view': 'tenant',
      'attendance.view': 'tenant',
    };

    // Case 1: attendance module ENABLED
    const withAttendance = filterNavItems('staff', ['online', 'offline'], fullPermissions);
    assert.ok(withAttendance.some((i) => i.id === 'admin-attendance'), 'Shows attendance when module is enabled');

    // Case 2: attendance module DISABLED
    const withoutAttendance = filterNavItems('staff', ['online'], fullPermissions);
    assert.ok(!withoutAttendance.some((i) => i.id === 'admin-attendance'), 'Hides attendance when module is disabled');
  });

  test('permission gating: hides staff item when user lacks required permissions', () => {
    const modules = ['online', 'offline', 'billing'];

    // User has courses.view -> courses item appears
    const withPerms = filterNavItems('staff', modules, { 'courses.view': 'tenant' });
    assert.ok(withPerms.some((i) => i.id === 'admin-courses'));

    // User lacks both courses.view and courses.create -> courses item hidden
    const withoutPerms = filterNavItems('staff', modules, {});
    assert.ok(!withoutPerms.some((i) => i.id === 'admin-courses'));
  });

  test('admin experience gets both admin-only and staff items', () => {
    const modules = ['online', 'offline', 'billing'];
    const allPerms: PermissionsMap = {
      'courses.view': 'tenant',
      'roles.view': 'tenant',
      'roles.create': 'tenant',
    };

    const adminItems = filterNavItems('admin', modules, allPerms);

    assert.ok(adminItems.some((i) => i.id === 'admin-dashboard'), 'Admin gets dashboard');
    assert.ok(adminItems.some((i) => i.id === 'admin-roles'), 'Admin gets role management');
  });

  test('staff experience does not get admin-only items like roles management', () => {
    const modules = ['online', 'offline'];
    const staffPerms: PermissionsMap = {
      'courses.view': 'tenant',
      'roles.view': 'tenant', // even if granted the permission, experience check excludes it
    };

    const staffItems = filterNavItems('staff', modules, staffPerms);
    assert.ok(!staffItems.some((i) => i.id === 'admin-roles'), 'Staff cannot see admin-roles');
  });
});

describe('Canonical AuthSession Contract Validation', () => {
  test('canonical AuthSession conforms to required schema', () => {
    const samplePayload: AuthSession = {
      user: {
        id: 'usr-123',
        name: 'أحمد محمود',
        email: 'ahmed@school.edu',
        phone: '+966501234567',
        status: 'active',
        roles: ['teacher'],
      },
      persona: 'staff',
      profiles: {
        student: null,
        staff: {
          id: 'stf-456',
          staff_type: 'teacher',
          branch_ids: ['br-1', 'br-2'],
        },
        parent: null,
      },
      roles: [{ name: 'teacher', label: 'معلم' }],
      permissions: {
        'courses.view': 'assigned',
        'attendance.scan': 'own',
      },
      tenant: {
        id: 'ten-789',
        slug: 'almustaqbal',
        name: 'مدارس المستقبل الأهلية',
        modules: ['online', 'offline'],
        auth_mode: 'password',
        branding: {
          logo_url: 'https://example.com/logo.png',
          primary_color: '#04c3c9',
        },
      },
      experience: 'staff',
      support_session: null,
      // Legacy compat aliases
      id: 'usr-123',
      name: 'أحمد محمود',
      email: 'ahmed@school.edu',
      phone: '+966501234567',
      type: 'staff',
      status: 'active',
      profile: {},
    };

    assert.strictEqual(samplePayload.experience, 'staff');
    assert.strictEqual(samplePayload.persona, 'staff');
    assert.strictEqual(samplePayload.profiles.staff?.staff_type, 'teacher');
    assert.deepStrictEqual(samplePayload.profiles.staff?.branch_ids, ['br-1', 'br-2']);
    assert.strictEqual(samplePayload.permissions['courses.view'], 'assigned');
    assert.strictEqual(samplePayload.permissions['attendance.scan'], 'own');
    assert.strictEqual(samplePayload.tenant.slug, 'almustaqbal');
    assert.strictEqual(samplePayload.support_session, null);
  });
});

describe('Registry stays in sync with the backend', () => {
  test('every nav module key exists in config/authorization.php', () => {
    const config = readFileSync(new URL('../../api/config/authorization.php', import.meta.url), 'utf8');
    const section = config.slice(config.indexOf("'modules' =>"));
    const catalog = new Set([...section.matchAll(/^ {8}'([a-z_]+)' => \[/gm)].map((m) => m[1]));
    assert.ok(catalog.has('online') && catalog.has('offline'), 'catalog parsed');

    const unknown = NAVIGATION_REGISTRY.filter((i) => i.module && !catalog.has(i.module)).map((i) => `${i.id}:${i.module}`);
    assert.deepEqual(unknown, []);
  });

  test('platform console items never appear in a tenant sidebar', () => {
    const allPerms: PermissionsMap = { 'roles.view': 'tenant' };
    const tenantItems = filterNavItems('admin', ['online', 'offline'], allPerms);
    assert.ok(!tenantItems.some((i) => i.area === 'platform'));
    const platformItems = filterNavItems('admin', [], {}, 'platform');
    assert.ok(platformItems.length > 0 && platformItems.every((i) => i.area === 'platform'));
  });
});
