/**
 * Landing page content (OD-21).
 *
 * Everything marked `sample: true` is placeholder marketing content: fictional names, generated
 * logos, illustrative numbers. Rules:
 *   - no real people, organizations or logos;
 *   - replace with real, verifiable content before launch;
 *   - scripts/release-gate.ps1 fails while any `sample: true` remains in this file.
 */

export interface Sampled {
  sample?: true;
}

export const HERO = {
  eyebrow: 'منصة تعليمية سحابية للمراكز والأكاديميات',
  title: 'كل ما تحتاجه أكاديميتك',
  titleAccent: 'في سحابة واحدة',
  description:
    'دروس مسجّلة وحصص مباشرة، حضور بالرمز، تقييمات واشتراكات — منصة عربية واحدة تجمع الطالب والمعلم والإدارة وولي الأمر.',
  primaryCta: { label: 'سجّل أكاديميتك', href: '/register-school' },
  secondaryCta: { label: 'تسجيل الدخول', href: '/login' },
};

export const STATS: ({ value: string; label: string } & Sampled)[] = [
  { value: '+١٢٠', label: 'مركز وأكاديمية', sample: true },
  { value: '+٣٨ ألف', label: 'طالب نشط', sample: true },
  { value: '٩٨٪', label: 'نسبة حضور مسجّلة رقمياً', sample: true },
  { value: '٤٫٨ / ٥', label: 'متوسط رضا المعلمين', sample: true },
];

/** Generated wordmarks for fictional academies (rendered as geometric marks + name). */
export const LOGOS: ({ name: string; shape: 'arch' | 'star' | 'dome' | 'wave' | 'tower' } & Sampled)[] = [
  { name: 'أكاديمية الواحة', shape: 'arch', sample: true },
  { name: 'مركز النخبة', shape: 'star', sample: true },
  { name: 'معهد الأفق', shape: 'dome', sample: true },
  { name: 'مدارس الرمال', shape: 'wave', sample: true },
  { name: 'أكاديمية المنارة', shape: 'tower', sample: true },
];

export type RoleKey = 'student' | 'teacher' | 'admin' | 'parent';

export const ROLE_FEATURES: Record<RoleKey, { label: string; title: string; items: { icon: string; title: string; text: string }[] }> = {
  student: {
    label: 'الطالب',
    title: 'رحلة تعلّم واضحة من أول درس',
    items: [
      { icon: 'PlayCircle', title: 'تابع من حيث توقفت', text: 'استكمل الدرس الأخير بضغطة واحدة مع حفظ تقدّمك.' },
      { icon: 'CalendarClock', title: 'مواعيدك أمامك', text: 'الحصص والواجبات والاختبارات القادمة بعدّ تنازلي.' },
      { icon: 'QrCode', title: 'بطاقتك الرقمية', text: 'رمز حضور آمن قصير العمر يُمسح عند الدخول.' },
      { icon: 'Award', title: 'درجاتك وتقدّمك', text: 'نتائج واضحة وملاحظات المعلمين في مكان واحد.' },
    ],
  },
  teacher: {
    label: 'المعلّم',
    title: 'وقت أقل في الإدارة، أكثر في التعليم',
    items: [
      { icon: 'BookOpen', title: 'بناء المقررات', text: 'دروس فيديو ومستندات وملاحظات مرتبة بمنهج واضح.' },
      { icon: 'ScanLine', title: 'رصد الحضور بالمسح', text: 'امسح بطاقات الطلاب من الجوال وانتهِ في دقائق.' },
      { icon: 'ClipboardCheck', title: 'اختبارات وتصحيح', text: 'منشئ اختبارات وقائمة تصحيح مرتبة حسب الأولوية.' },
      { icon: 'Video', title: 'حصص مباشرة', text: 'جدولة الحصص وروابطها ومتابعة الحضور فيها.' },
    ],
  },
  admin: {
    label: 'الإدارة',
    title: 'تشغيل أكاديميتك بثقة',
    items: [
      { icon: 'Users', title: 'المستخدمون والأدوار', text: 'صلاحيات دقيقة لكل دور مع سجل تدقيق كامل.' },
      { icon: 'ReceiptText', title: 'الاشتراكات والمدفوعات', text: 'باقات وأسعار ومراجعة تحويلات بخطوات واضحة.' },
      { icon: 'Building2', title: 'الفروع والقاعات', text: 'إدارة الفروع والشُّعب والقاعات من لوحة واحدة.' },
      { icon: 'ChartColumn', title: 'مؤشرات الأداء', text: 'الحضور والإيرادات والتقدّم الأكاديمي لحظة بلحظة.' },
    ],
  },
  parent: {
    label: 'ولي الأمر',
    title: 'اطمئنان يومي على أبنائك',
    items: [
      { icon: 'HeartHandshake', title: 'متابعة كل الأبناء', text: 'بطاقة لكل ابن: الحضور وآخر الدرجات والتنبيهات.' },
      { icon: 'Bell', title: 'تنبيهات مهمة', text: 'غياب أو تأخر في التسليم؟ تعرف في الوقت المناسب.' },
      { icon: 'FileText', title: 'تقارير قابلة للطباعة', text: 'ملف أكاديمي شامل جاهز للطباعة والمشاركة.' },
      { icon: 'Wallet', title: 'المدفوعات بوضوح', text: 'سجل الاشتراكات والمدفوعات وحالتها.' },
    ],
  },
};

export const STEPS = [
  { title: 'سجّل أكاديميتك', text: 'أنشئ مساحة مؤسستك وحدّد الفروع والوحدات التي تحتاجها.' },
  { title: 'أضف المعلمين والطلاب', text: 'استورد الطلاب من ملف وأرسل أكواد الدخول بأمان.' },
  { title: 'ابدأ التعليم', text: 'انشر الدروس وجدول الحصص وتابع الحضور والنتائج.' },
];

export const TESTIMONIALS: ({ quote: string; name: string; role: string } & Sampled)[] = [
  {
    quote: 'انتقلنا من جداول متفرقة إلى منصة واحدة، وصار رصد الحضور يأخذ دقيقتين بدل ربع ساعة.',
    name: 'أ. نورة الحربي',
    role: 'مديرة أكاديمية الواحة',
    sample: true,
  },
  {
    quote: 'أكثر ما أعجبني وضوح الواجهة بالعربي؛ الطلاب يجدون ما يحتاجونه دون أن يسألوا.',
    name: 'أ. خالد العتيبي',
    role: 'معلم رياضيات — مركز النخبة',
    sample: true,
  },
  {
    quote: 'أتابع حضور ابني ودرجاته من الجوال، وتصلني التنبيهات في وقتها.',
    name: 'م. فهد القحطاني',
    role: 'ولي أمر',
    sample: true,
  },
];

export const FAQ = [
  { q: 'هل بيانات أكاديميتي معزولة عن غيرها؟', a: 'نعم. لكل مؤسسة قاعدة بيانات مستقلة، والصلاحيات تُفرض من الخادم لكل طلب.' },
  { q: 'هل تدعم المنصة الحصص المباشرة؟', a: 'نعم، يمكن جدولة الحصص المباشرة وربطها وتتبّع حضورها من نفس المنصة.' },
  { q: 'كيف يسجّل الطلاب الحضور؟', a: 'يعرض الطالب رمز QR قصير العمر من بطاقته الرقمية، ويمسحه المعلم أو المساعد من الجوال.' },
  { q: 'هل يمكن تجربة المنصة قبل الاشتراك؟', a: 'يمكنك تسجيل أكاديميتك والبدء، وفريقنا يساعدك في الإعداد الأول.' },
];

/** True while any placeholder content remains (used to label sections in development). */
export const HAS_SAMPLE_CONTENT = [...STATS, ...LOGOS, ...TESTIMONIALS].some((i) => i.sample);
