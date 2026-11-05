/**
 * Global TypeScript domain types matching Laravel Backend API contracts.
 */

export interface TenantFeatureItem {
  id?: string;
  tenant_id?: string;
  feature_key: string;
  enabled: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: string;
  organization_kind?: 'center' | 'academy' | 'school' | 'institute' | null;
  city?: string | null;
  contact_phone?: string | null;
  services?: string[] | null;
  features?: TenantFeatureItem[] | null;
  auth_mode?: 'password' | 'coupon' | 'hybrid';
  status: 'active' | 'suspended' | 'provisioning' | 'archived';
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  brand_tagline?: string | null;
  brand_settings?: Record<string, unknown> | null;
}

export interface TenantUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  type: 'student' | 'staff' | 'parent';
  status: 'active' | 'suspended';
  student?: Student;
  staff?: Staff;
  parent?: ParentProfile;
  roles?: Role[];
}

export interface StudentEnrollment {
  id: string;
  course_id?: string;
  course?: { id: string; title: string; code?: string };
  status: string;
  enrolled_at?: string;
  created_at?: string;
}

export interface StudentParent {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  relationship?: string;
  user?: TenantUser;
}

export interface Student {
  id: string;
  user_id: string;
  student_code: string;
  grade_level?: string;
  status: string;
  created_at?: string;
  user?: TenantUser;
  enrollments?: StudentEnrollment[];
  parents?: StudentParent[];
}

export interface Staff {
  id: string;
  user_id: string;
  staff_type: 'teacher' | 'assistant' | 'admin';
  status: string;
  user?: TenantUser;
}

export interface ParentProfile {
  id: string;
  user_id: string;
  status: string;
  students?: Student[];
}

export interface Role {
  id: string;
  name: string;
  label: string;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  module: string;
}

export interface ContentAccessDecision {
  allowed: boolean;
  reason: 'ok' | 'draft' | 'not_enrolled' | 'no_entitlement' | 'expired';
  required_package_ids?: string[];
}

export interface LessonMaterial {
  id: string;
  lesson_id: string;
  title: string;
  kind: 'file' | 'link';
  storage_path?: string | null;
  url?: string | null;
  mime?: string | null;
  size?: number | null;
  sort_order: number;
  created_at?: string;
}

export interface LessonProgressData {
  percent: number;
  last_position_seconds: number;
  completed_at?: string | null;
  watch_seconds?: number;
}

export interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  description?: string | null;
  sort_order: number;
  status: 'draft' | 'published';
  lessons?: Lesson[];
  created_at?: string;
}

export interface Course {
  id: string;
  title: string;
  code: string;
  description?: string;
  cover_path?: string;
  /** Outline endpoint: whether an image is stored (the path itself is never exposed there). */
  has_cover?: boolean;
  level?: 'beginner' | 'intermediate' | 'advanced';
  status: 'draft' | 'published' | 'active' | 'archived';
  is_free?: boolean;
  is_public?: boolean;
  published_at?: string;
  access?: ContentAccessDecision;
  teacher_id?: string;
  teacher_staff_id?: string;
  teacher?: Staff;
  modules?: CourseModule[];
  lessons?: Lesson[];
  enrollments_count?: number;
}

export interface Lesson {
  id: string;
  course_id: string;
  module_id?: string | null;
  title: string;
  content?: string | null;
  type?: 'video' | 'document' | 'text' | 'assignment' | 'exam' | 'live';
  description?: string;
  sort_order: number;
  video_url?: string;
  duration_minutes?: number;
  duration_seconds?: number;
  ref_id?: string | null;
  status?: 'draft' | 'published';
  is_free_preview?: boolean;
  published_at?: string | null;
  access?: ContentAccessDecision;
  materials?: LessonMaterial[];
  media_assets?: MediaAsset[];
  mediaAssets?: MediaAsset[];
  progress?: LessonProgressData;
}

export interface Branch {
  id: string;
  name: string;
  code?: string;
  status?: string;
  classrooms_count?: number;
}

export interface Classroom {
  id: string;
  branch_id?: string;
  name: string;
  capacity: number;
  status?: string;
  branch?: Branch;
}

export interface AttendanceRecordChange {
  id: string;
  attendance_record_id: string;
  changed_by_user_id?: string;
  old_status: string;
  new_status: string;
  reason: string;
  created_at: string;
  changed_by?: TenantUser;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  recorded_by_user_id?: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  attendance_mode: 'manual' | 'qr';
  notes?: string;
  recorded_at: string;
  student?: Student;
  recorded_by?: TenantUser;
  session?: ClassSession;
  changes?: AttendanceRecordChange[];
}

export interface ClassSession {
  id: string;
  class_id: string;
  classroom_id?: string;
  title: string;
  starts_at?: string;
  ends_at?: string;
  session_date?: string;
  attendance_mode: 'manual' | 'qr' | 'both';
  timing_mode?: 'scheduled' | 'open';
  grace_period_minutes?: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  classroom?: Classroom;
  school_class?: SchoolClass;
  attendance_records?: AttendanceRecord[];
}

export interface SchoolClass {
  id: string;
  name: string;
  code?: string;
  branch_id?: string;
  teacher_staff_id?: string;
  course_id?: string;
  course?: { id?: string; title: string };
  status?: 'active' | 'archived';
  branch?: Branch;
  teacher?: Staff;
  students?: Student[];
  sessions?: ClassSession[];
  students_count?: number;
  sessions_count?: number;
}

export interface StudentQrTokenData {
  token: string;
  expires_at: string;
  expires_in_seconds: number;
  student: {
    id: string;
    name: string;
    student_code: string;
    grade_level?: string;
    photo_initial?: string;
  };
  tenant: {
    id: string;
    name: string;
    logo_url?: string;
    primary_color?: string;
  };
}

export interface AttendanceScanResult {
  already_recorded: boolean;
  record: AttendanceRecord;
  student: {
    id: string;
    name: string;
    student_code: string;
    photo_initial: string;
    status: string;
  };
  message: string;
}

export interface StudentAttendanceSummary {
  summary: {
    total_records: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendance_rate: number;
  };
  classes: Array<{
    class_id: string;
    class_name: string;
    code?: string;
    total_sessions: number;
    present: number;
    absent: number;
    late: number;
    attendance_rate: number;
  }>;
  records: AttendanceRecord[];
}

export interface Assignment {
  id: string;
  course_id: string;
  lesson_id?: string;
  title: string;
  description?: string;
  points_possible: number;
  due_at?: string;
  allow_late?: boolean;
  late_penalty_percent?: number;
  allow_resubmission?: boolean;
  max_file_size_mb?: number;
  allowed_file_types?: string;
  status: 'draft' | 'published' | 'archived';
  my_submission?: AssignmentSubmission;
  course?: { id: string; title: string };
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  attempt_number?: number;
  content?: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  score?: number;
  feedback?: string;
  status: 'submitted' | 'graded';
  submitted_at?: string;
  is_late?: boolean;
  is_grade_published?: boolean;
  graded_at?: string;
  student?: {
    id: string;
    user?: {
      id?: string;
      name?: string;
      email?: string;
    };
  };
  assignment?: Assignment;
}

export interface ExamQuestion {
  id: string;
  exam_id: string;
  bank_id?: string;
  question_text: string;
  question_type: 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_answer' | 'essay';
  points: number;
  options?: string[];
  correct_answer?: string;
  acceptable_answers?: string[];
  explanation?: string;
  sort_order: number;
}

export interface ExamAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  answer_text?: string;
  selected_options?: string[];
  is_correct?: boolean | null;
  awarded_points?: number | null;
  feedback?: string;
  question?: ExamQuestion;
}

export interface ExamAttempt {
  id: string;
  exam_id: string;
  student_id: string;
  attempt_number: number;
  started_at: string;
  expires_at?: string;
  submitted_at?: string;
  score?: number;
  feedback?: string;
  status: 'created' | 'started' | 'in_progress' | 'submitted' | 'graded' | 'published';
  answers?: ExamAnswer[];
  student?: {
    id: string;
    user?: {
      id?: string;
      name?: string;
      email?: string;
    };
  };
  exam?: Exam;
}

export interface Exam {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  opens_at?: string;
  closes_at?: string;
  total_points: number;
  passing_score?: number;
  duration_minutes: number;
  max_attempts?: number;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  show_results?: 'after_submit' | 'after_publish' | 'never';
  is_published?: boolean;
  is_grades_published?: boolean;
  status: 'draft' | 'published' | 'closed' | 'archived' | 'completed';
  questions_count?: number;
  questions?: ExamQuestion[];
  student_attempts?: ExamAttempt[];
  can_attempt?: boolean;
  course?: { id: string; title: string };
}

export interface QuestionBank {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  questions_count?: number;
  questions?: BankQuestion[];
}

export interface BankQuestion {
  id: string;
  bank_id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_answer' | 'essay';
  points: number;
  options?: string[];
  correct_answer?: string;
  acceptable_answers?: string[];
  explanation?: string;
}

export interface PendingGradingResponse {
  count: number;
  submissions: AssignmentSubmission[];
  attempts: ExamAttempt[];
}

export interface Grade {
  id: string;
  student_id: string;
  score: number;
  max_score: number;
  percentage: number;
  is_published: boolean;
  gradable_type: string;
  feedback?: string;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  provider: 'manual' | 'google_meet' | 'zoom' | 'mock';
  external_meeting_id: string;
  /** Staff only; students get the link from the join endpoint. */
  join_url?: string;
  host_url?: string;
  passcode?: string;
  start_time?: string;
  duration_minutes: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  course_id?: string;
  session_id?: string;
  course?: Course;
}

export interface MediaAsset {
  id: string;
  title: string;
  provider: string;
  external_media_id: string;
  media_type?: 'video' | 'audio' | 'document' | string;
  embed_url?: string;
  playback_url?: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed' | string;
  duration_seconds?: number;
  size_bytes?: number;
  course_id?: string;
  lesson_id?: string;
  course?: Course;
  lesson?: Lesson;
  created_at?: string;
}

export interface StudentAnalyticsSnapshot {
  student_id: string;
  /** Null means "no data yet": never display it as 0 or 100. */
  attendance_rate: number | null;
  assignment_completion_rate: number | null;
  exam_average: number | null;
  overall_score: number | null;
  lesson_completion_rate?: number | null;
  last_activity_at?: string | null;
  total_courses?: number;
  completed_courses?: number;
  radar?: Record<string, number>;
  last_calculated_at?: string;
}

export interface MetricDefinition {
  id: string;
  key: string;
  name: string;
  category: string;
  current_version: number;
  calculation_formula?: string;
}

export interface ReportInstance {
  id: string;
  title: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  format: string;
  file_path?: string;
  created_at: string;
  completed_at?: string;
  data_payload?: Record<string, unknown>;
}
