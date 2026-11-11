import { redirect } from 'next/navigation';

/** Exams and assignments now have their own pages; this keeps old links working. */
export default function TeacherAssessmentsPage() {
  redirect('/teacher/exams');
}
