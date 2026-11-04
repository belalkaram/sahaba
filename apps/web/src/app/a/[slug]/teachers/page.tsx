'use client';

import React from 'react';
import { useAcademy } from '../../../../features/public-academy/academy-context';
import { usePublicData } from '../../../../features/public-academy/use-public-data';
import { SectionTitle, TeacherList } from '../../../../features/public-academy/list-sections';
import { publicAcademyApi } from '../../../../lib/public-api';

export default function AcademyTeachersPage() {
  const academy = useAcademy();
  const state = usePublicData(() => publicAcademyApi.teachers(academy.slug), [academy.slug]);

  return (
    <div className="mx-auto max-w-[var(--content-max)] px-4 py-12 sm:px-6">
      <SectionTitle title="المدرسون" subtitle="تعرّف على فريق التدريس ومقرراتهم." />
      <TeacherList state={state} slug={academy.slug} />
    </div>
  );
}
