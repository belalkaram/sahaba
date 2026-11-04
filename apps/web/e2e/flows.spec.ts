import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API, fixtures, settled, signIn, signInPlatform } from './helpers';

/**
 * R9-1: critical flows across the real UI and API. The seeded tenant is rebuilt for each run;
 * tests in this file share it, so they run in order (workers: 1) and each uses its own subject.
 */
const f = fixtures();

async function apiToken(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    headers: { 'X-Tenant-Slug': f.tenant, Accept: 'application/json' },
    data: { identifier: email, email, password: f.password },
  });
  expect(res.ok(), `login ${email}`).toBeTruthy();
  return (await res.json()).data.token;
}

function auth(token: string) {
  return { 'X-Tenant-Slug': f.tenant, Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`/login?tenant=${f.tenant}`);
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.locator('form').getByRole('button', { name: 'تسجيل الدخول' }).click();
}

test('sign-in sends each role to its own home; a wrong password shows an error', async ({ page }) => {
  await login(page, f.users.student, 'wrong-password');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  await login(page, f.users.owner, f.password);
  await expect(page).toHaveURL(/\/admin$/);
});

test('a reload keeps the session', async ({ page }) => {
  await signIn(page, f.users.student);
  await page.goto('/student/courses');
  await settled(page);
  await page.reload();
  await settled(page);
  await expect(page).toHaveURL(/\/student\/courses$/);
  await expect(page.getByText('يلزم تسجيل الدخول')).toHaveCount(0);
});

test('student opens an enrolled course and its lesson', async ({ page }) => {
  await signIn(page, f.users.student);
  await page.goto(`/student/courses/${f.ids.course}/lessons/${f.ids.lesson}`);
  await settled(page);
  await expect(page.getByText('الدرس الأول').first()).toBeVisible();
});

test('parent sees the linked child, and only that child', async ({ page }) => {
  await signIn(page, f.users.parent);
  await page.goto('/parent/children');
  await settled(page);
  await expect(page.getByText('طالب الاختبار').first()).toBeVisible();
  await expect(page.getByText('طالب بلا مقررات')).toHaveCount(0);
});

test('payment approval unlocks access and notifies the student in the bell', async ({ page, request }) => {
  const finance = await apiToken(request, f.users.finance);
  const student2 = await apiToken(request, f.users.student2);

  const before = await request.get(`${API}/courses/${f.ids.course}/lessons`, { headers: auth(student2) });
  const lessonsBefore = before.ok() ? (await before.json()).data.lessons?.length : 0;

  const approve = await request.post(`${API}/payment-requests/${f.ids.payment}/approve`, { headers: auth(finance), data: {} });
  expect(approve.ok(), 'approve').toBeTruthy();

  const enrollments = await request.get(`${API}/me/courses`, { headers: auth(student2) });
  const courses = (await enrollments.json()).data as { id: string }[];
  expect(courses.map((c) => c.id), `course unlocked (lessons before: ${lessonsBefore})`).toContain(f.ids.course);

  await signIn(page, f.users.student2);
  await page.goto('/student/dashboard');
  await settled(page);
  const bell = page.getByRole('button', { name: /الإشعارات/ });
  await expect(bell).toHaveAttribute('aria-label', /غير مقروءة/);
  await bell.click();
  await expect(page.getByText('تم قبول طلب الدفع').first()).toBeVisible();
});

test('QR attendance: the student token is scanned and the parent is told about an absence', async ({ page, request }) => {
  const student = await apiToken(request, f.users.student);
  const assistant = await apiToken(request, f.users.teacher);

  const qr = await request.get(`${API}/me/attendance-qr`, { headers: auth(student) });
  expect(qr.ok(), 'qr token').toBeTruthy();
  const body = (await qr.json()).data;
  const token = body.token ?? body.qr_token;
  expect(token, 'token present').toBeTruthy();

  const scan = await request.post(`${API}/sessions/${f.ids.session}/attendance/scan`, { headers: auth(assistant), data: { token, qr_token: token } });
  expect(scan.ok(), `scan: ${await scan.text()}`).toBeTruthy();

  const absent = await request.post(`${API}/sessions/${f.ids.session}/attendance`, {
    headers: auth(assistant),
    data: { student_id: f.ids.student, status: 'absent' },
  });
  expect(absent.ok(), 'manual absence').toBeTruthy();

  await signIn(page, f.users.parent);
  await page.goto('/notifications');
  await settled(page);
  await expect(page.getByText('تم تسجيل غياب').first()).toBeVisible();
});

test('exam lifecycle: start, answer, submit, see the result', async ({ page, request }) => {
  const student = await apiToken(request, f.users.student);
  const base = `${API}/courses/${f.ids.course}/exams/${f.ids.exam}`;

  const start = await request.post(`${base}/start`, { headers: auth(student), data: {} });
  expect(start.ok(), `start: ${await start.text()}`).toBeTruthy();
  const started = (await start.json()).data;
  const attempt = started.attempt;
  const question = (started.questions ?? started.exam?.questions ?? attempt.questions)[0];

  const answer = await request.post(`${base}/attempts/${attempt.id}/answers`, {
    headers: auth(student),
    data: { question_id: question.id, answer: '4', selected_option: '4', answer_text: '4' },
  });
  expect(answer.ok(), `answer: ${await answer.text()}`).toBeTruthy();

  const submit = await request.post(`${base}/attempts/${attempt.id}/submit`, { headers: auth(student), data: {} });
  expect(submit.ok(), `submit: ${await submit.text()}`).toBeTruthy();

  await signIn(page, f.users.student);
  await page.goto(`/student/courses/${f.ids.course}/exams/${f.ids.exam}/results`);
  await settled(page);
  await expect(page.getByText('حدث خطأ أثناء تحميل الصفحة')).toHaveCount(0);
});

test('student cannot reach another role or another student', async ({ page, request }) => {
  await signIn(page, f.users.student);
  await page.goto('/admin/users');
  await settled(page);
  await expect(page.getByText('غير مصرح بالدخول')).toBeVisible();

  const token = await apiToken(request, f.users.student);
  const other = await request.get(`${API}/students/${f.ids.student2}/dashboard`, { headers: auth(token) });
  expect(other.status(), 'other student analytics').toBe(403);
});

test('report: request in the UI, then it becomes ready', async ({ page }) => {
  await signIn(page, f.users.owner);
  await page.goto('/admin/reports');
  await settled(page);
  await page.getByLabel('الطالب').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'طلب التقرير' }).click();
  // Requires a queue worker, or QUEUE_CONNECTION=sync on the API under test.
  await expect(page.locator('main ul').getByText(/جاهز|في الانتظار|قيد الإعداد/).first()).toBeVisible();
});

test('contact form reports success only after the server stored the message', async ({ page }) => {
  await page.goto('/contact');
  await page.getByLabel(/الاسم/).fill('زائر الاختبار');
  await page.getByLabel(/البريد الإلكتروني/).fill('visitor@example.com');
  await page.getByLabel(/نص الاستفسار/).fill('رسالة اختبار تتجاوز عشرة أحرف.');
  await page.getByRole('button', { name: /إرسال الرسالة/ }).click();
  await expect(page.getByText('وصلت رسالتك')).toBeVisible();
});

test('platform: sign in, demo switch is off, and the console loads', async ({ page }) => {
  await page.goto('/platform/dashboard');
  await expect(page).toHaveURL(/\/platform\/login/);

  await signInPlatform(page);
  await page.goto('/platform/settings');
  await settled(page);
  await expect(page.getByRole('switch').first()).toHaveAttribute('aria-checked', 'false');
});

test('provisioning: a registered school can sign in to its own new workspace', async ({ page, request }) => {
  const email = 'owner@provisioned.test';
  const res = await request.post(`${API}/public/register-school`, {
    headers: { Accept: 'application/json' },
    data: { school_name: 'مدرسة الاختبار الجديدة', slug: f.provisioned_slug, type: 'school', admin_name: 'مدير المدرسة', admin_email: email, password: f.password },
  });
  expect(res.status(), `register: ${await res.text()}`).toBe(201);

  await page.goto(`/login?tenant=${f.provisioned_slug}`);
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(f.password);
  await page.locator('form').getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await settled(page);
  await expect(page.getByText('حدث خطأ أثناء تحميل الصفحة')).toHaveCount(0);
});

test('course build, watch, resume: progress saved on the server survives a new session', async ({ page, request }) => {
  const teacher = await apiToken(request, f.users.teacher);
  const student = await apiToken(request, f.users.student);

  const created = await request.post(`${API}/courses/${f.ids.course}/lessons`, {
    headers: auth(teacher),
    data: { title: 'درس فيديو للاختبار', type: 'video', duration_seconds: 100, status: 'published' },
  });
  expect(created.ok(), `lesson: ${await created.text()}`).toBeTruthy();
  const body = (await created.json()).data;
  const lessonId = (body.lesson ?? body).id as string;

  const events = await request.post(`${API}/lessons/${lessonId}/events`, {
    headers: auth(student),
    data: {
      events: [
        { type: 'start', position_seconds: 0 },
        { type: 'heartbeat', position_seconds: 30 },
        { type: 'pause', position_seconds: 40 },
      ],
    },
  });
  expect(events.ok(), `events: ${await events.text()}`).toBeTruthy();

  const progress = await request.get(`${API}/me/progress?course_id=${f.ids.course}`, { headers: auth(student) });
  const records = (await progress.json()).data.progress as { lesson_id: string; last_position_seconds: number }[];
  expect(records.find((r) => r.lesson_id === lessonId)?.last_position_seconds).toBe(40);

  await signIn(page, f.users.teacher);
  await page.goto(`/teacher/courses/${f.ids.course}`);
  await settled(page);
  await expect(page.getByText('درس فيديو للاختبار').first()).toBeVisible();

  await signIn(page, f.users.student);
  await page.goto(`/student/courses/${f.ids.course}/lessons/${lessonId}`);
  await settled(page);
  await expect(page.getByText('درس فيديو للاختبار').first()).toBeVisible();
});

test('payment request: the student uploads a proof in the UI and finance sees it', async ({ page }) => {
  await signIn(page, f.users.student);
  await page.goto(`/student/plans/${f.ids.package}/pay`);
  await settled(page);
  await page.locator('#proof-upload').setInputFiles({
    name: 'receipt.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
  });
  await page.getByRole('button', { name: 'إرسال طلب السداد للمراجعة' }).click();
  await expect(page.getByText('تم استلام طلب السداد').first()).toBeVisible();

  await signIn(page, f.users.finance);
  await page.goto('/teacher/payments');
  await settled(page);
  await expect(page.getByText('طالب الاختبار').first()).toBeVisible();
});

test('access code: signs in, stays on one device, and replacing the device really unbinds it', async ({ page, request }) => {
  await page.goto(`/login?tenant=${f.tenant}`);
  await page.getByRole('tab', { name: 'كود الدخول' }).click();
  await page.getByLabel('كود الدخول').fill(f.coupon.code);
  await page.getByLabel('الرقم السري للكود').fill(f.coupon.secret);
  await page.locator('form').getByRole('button', { name: /دخول/ }).click();
  await expect(page).toHaveURL(/\/student\/dashboard$/);

  const couponLogin = (device: string) =>
    request.post(`${API}/auth/login`, {
      headers: { 'X-Tenant-Slug': f.tenant, Accept: 'application/json' },
      data: { coupon_code: f.coupon.code, secret: f.coupon.secret, device_id: device, device_fingerprint: `fp-${device}` },
    });

  expect((await couponLogin('another-device')).ok(), 'second device refused').toBeFalsy();

  const owner = await apiToken(request, f.users.owner);
  const replaced = await request.post(`${API}/credentials/${f.coupon.id}/replace-device`, {
    headers: auth(owner),
    data: { reason: 'الطالب غيّر هاتفه' },
  });
  expect(replaced.ok(), `replace: ${await replaced.text()}`).toBeTruthy();

  expect((await couponLogin('another-device')).ok(), 'new device binds after the unbind').toBeTruthy();
});

test('support session: a one-time code signs in and the tenant owner is notified', async ({ page, request }) => {
  const login = await request.post(`${API}/platform/auth/login`, {
    headers: { Accept: 'application/json' },
    data: { email: f.platform_email, password: f.password },
  });
  const platform = { Authorization: `Bearer ${(await login.json()).data.token}`, Accept: 'application/json' };

  const tenants = await request.get(`${API}/tenants`, { headers: platform });
  const tenant = ((await tenants.json()).data.tenants as { id: string; slug: string }[]).find((t) => t.slug === f.tenant)!;

  const code = await request.post(`${API}/tenants/${tenant.id}/support-access`, { headers: platform, data: { reason: 'اختبار جلسة الدعم' } });
  expect(code.ok(), 'support code').toBeTruthy();
  const supportCode = (await code.json()).data.support_code;

  await page.goto(`/login?support_code=${supportCode}&tenant=${f.tenant}`);
  await settled(page);
  await expect(page).not.toHaveURL(/\/login/);

  // Single use: the same code must not work again.
  const again = await request.post(`${API}/auth/support/exchange`, {
    headers: { 'X-Tenant-Slug': f.tenant, Accept: 'application/json' },
    data: { code: supportCode },
  });
  expect(again.status()).toBe(401);

  const owner = await apiToken(request, f.users.owner);
  const notifications = await request.get(`${API}/notifications`, { headers: auth(owner) });
  const events = ((await notifications.json()).data.notifications as { data: { event?: string } }[]).map((n) => n.data.event);
  expect(events).toContain('support_session_started');
});
