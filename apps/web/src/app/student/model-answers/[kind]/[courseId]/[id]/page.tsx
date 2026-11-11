'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../components/ui/page-header';
import { buttonClasses } from '../../../../../../components/ui/button-styles';
import { ModelAnswersView } from '../../../../../../features/assessment/model-answers-view';

export default function StudentModelAnswersPage({ params }: { params: Promise<{ kind: string; courseId: string; id: string }> }) {
  const { kind, courseId, id } = use(params);
  if (kind !== 'exams' && kind !== 'assignments') notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="الحل النموذجي"
        subtitle="قارن إجاباتك بالحل النموذجي الذي أتاحه لك المعلم."
        actions={
          <Link href={kind === 'exams' ? '/student/exams' : '/student/assignments'} className={buttonClasses('secondary', 'md')}>
            رجوع
          </Link>
        }
      />
      <ModelAnswersView courseId={courseId} kind={kind} itemId={id} />
    </div>
  );
}
