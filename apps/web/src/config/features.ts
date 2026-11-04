/**
 * Build-time feature switches.
 *
 * OD-20 — demo accounts on the login page:
 *   NEXT_PUBLIC_DEMO_LOGIN="true"   always shown
 *   NEXT_PUBLIC_DEMO_LOGIN="false"  never shown
 *   unset, development              shown
 *   unset, production               decided at runtime by the platform-admin switch
 *                                   (/platform/settings -> GET /public/config, fail-closed)
 */
const demoFlag = process.env.NEXT_PUBLIC_DEMO_LOGIN;

export type DemoLoginMode = 'on' | 'off' | 'runtime';

export const DEMO_LOGIN_MODE: DemoLoginMode =
  demoFlag === 'true' ? 'on' : demoFlag === 'false' ? 'off' : process.env.NODE_ENV === 'development' ? 'on' : 'runtime';
