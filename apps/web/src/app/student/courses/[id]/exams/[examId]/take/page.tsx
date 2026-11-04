import { redirect } from 'next/navigation';

/** The in-shell exam runner was replaced by the secure full-page session. Old links land there. */
export default async function LegacyTakeRedirect({ params }: { params: Promise<{ id: string; examId: string }> }) {
  const { id, examId } = await params;
  redirect(`/exam/${id}/${examId}`);
}
