import type { AnnouncementDisplay, AnnouncementFrequency, AnnouncementState, AnnouncementTarget, AnnouncementTone } from '../../lib/announcement-api';

export const DISPLAY_COPY: Record<AnnouncementDisplay, { label: string; hint: string }> = {
  bell: { label: 'إشعار عادي', hint: 'يظهر في جرس الإشعارات أعلى الصفحة، ويقرؤه الشخص متى فتح الجرس.' },
  banner: { label: 'شريط أعلى الصفحة', hint: 'شريط ملوّن فوق محتوى كل صفحة، يبقى ظاهراً حتى يغلقه بـ ×.' },
  modal: { label: 'نافذة منبثقة', hint: 'تظهر فوق الشاشة فور الدخول وتمنع الاستخدام حتى يضغط × — أضمن طريقة لقراءتها.' },
};

export const FREQUENCY_COPY: Record<AnnouncementFrequency, { label: string; hint: string }> = {
  once: { label: 'مرة واحدة', hint: 'بعد أن يغلقه الشخص لا يظهر له مرة أخرى.' },
  persistent: { label: 'ثابت مع كل دخول', hint: 'يعود في كل مرة يسجّل فيها الدخول حتى ينتهي أو تسحبه.' },
};

export const TONE_COPY: Record<AnnouncementTone, string> = {
  info: 'معلومة',
  success: 'خبر سار',
  warning: 'تنبيه',
  danger: 'عاجل',
};

export const TARGET_COPY: Record<AnnouncementTarget, string> = {
  all: 'كل الطلاب',
  courses: 'طلاب مقررات محددة',
  classes: 'طلاب شُعب محددة',
  grades: 'صفوف دراسية محددة',
  students: 'طلاب بالاسم',
};

export const STATE_COPY: Record<AnnouncementState, { label: string; variant: 'success' | 'info' | 'neutral' | 'danger' }> = {
  live: { label: 'منشور الآن', variant: 'success' },
  scheduled: { label: 'مجدول', variant: 'info' },
  ended: { label: 'انتهى', variant: 'neutral' },
  withdrawn: { label: 'مسحوب', variant: 'danger' },
};
