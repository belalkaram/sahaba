'use client';

/**
 * R7A — Teacher Credentials & Device Management Page
 * Modularized into features/credentials/components (< 200 lines).
 */

import React, { useEffect, useState } from 'react';
import { credentialsApi, CredentialItem, IssueCredentialResponse } from '../../../lib/credentials-api';
import { educationApi } from '../../../lib/education-api';
import type { Student } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { PageHeader } from '../../../components/ui/page-header';
import { CredentialsStats } from '../../../features/credentials/components/credentials-stats';
import { CredentialsStudentSidebar } from '../../../features/credentials/components/credentials-student-sidebar';
import { CredentialsTable } from '../../../features/credentials/components/credentials-table';
import {
  IssueCredentialModal,
  ReplaceDeviceModal,
  RevokeCredentialModal,
} from '../../../features/credentials/components/credentials-modals';

import { X } from 'lucide-react';
export default function TeacherCredentialsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');

  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueExpiresAt, setIssueExpiresAt] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);
  const [issuedResult, setIssuedResult] = useState<IssueCredentialResponse | null>(null);

  const [replacingCred, setReplacingCred] = useState<CredentialItem | null>(null);
  const [replaceReason, setReplaceReason] = useState('');
  const [isReplacing, setIsReplacing] = useState(false);

  const [revokingCred, setRevokingCred] = useState<CredentialItem | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadStudents = async () => {
    try {
      const data = await educationApi.getStudents();
      setStudents(data);
      if (data.length > 0 && !selectedStudentId) {
        setSelectedStudentId(data[0].id);
      }
    } catch {
      setFeedback({ type: 'error', text: 'تعذر تحميل قائمة الطلاب من الخادم.' });
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudentCredentials = async (studentId: string) => {
    if (!studentId) return;
    setLoadingCreds(true);
    try {
      const list = await credentialsApi.getStudentCredentials(studentId);
      setCredentials(list);
    } catch {
      setFeedback({ type: 'error', text: 'تعذر تحميل سجل الأجهزة والأكواد لهذا الطالب.' });
    } finally {
      setLoadingCreds(false);
    }
  };

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentCredentials(selectedStudentId);
    }
  }, [selectedStudentId]);

  const currentStudent = students.find((s) => s.id === selectedStudentId) || null;

  const copyToClipboard = (text: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setFeedback({ type: 'success', text: `تم نسخ كود الدخول إلى الحافظة بنجاح.` });
    }
  };

  const handleIssueCredential = async () => {
    if (!selectedStudentId) return;
    setIsIssuing(true);
    try {
      const res = await credentialsApi.issueCredential(
        selectedStudentId,
        issueExpiresAt ? issueExpiresAt : undefined
      );
      setIssuedResult(res);
      setFeedback({ type: 'success', text: 'تم إنشاء وإصدار كود الدخول بنجاح.' });
      await loadStudentCredentials(selectedStudentId);
    } catch {
      setFeedback({ type: 'error', text: 'فشل إصدار كود الدخول.' });
    } finally {
      setIsIssuing(false);
    }
  };

  const handleReplaceDevice = async () => {
    if (!replacingCred || !replaceReason.trim()) return;
    setIsReplacing(true);
    try {
      await credentialsApi.replaceDevice(replacingCred.id, replaceReason.trim());
      setFeedback({ type: 'success', text: 'تم فك ارتباط الجهاز. يرتبط الجهاز الجديد عند دخول الطالب التالي.' });
      setReplacingCred(null);
      await loadStudentCredentials(selectedStudentId);
    } catch {
      setFeedback({ type: 'error', text: 'فشل استبدال الجهاز المقترن.' });
    } finally {
      setIsReplacing(false);
    }
  };

  const handleRevokeCredential = async () => {
    if (!revokingCred || !revokeReason.trim()) return;
    setIsRevoking(true);
    try {
      await credentialsApi.revoke(revokingCred.id, revokeReason.trim());
      setFeedback({ type: 'success', text: 'تم تعطيل كود الدخول بنجاح.' });
      setRevokingCred(null);
      await loadStudentCredentials(selectedStudentId);
    } catch {
      setFeedback({ type: 'error', text: 'فشل تعطيل كود الدخول.' });
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-6 text-start">
      <PageHeader
        title="أكواد الدخول وإدارة الأجهزة المقترنة"
        description="التحكم في تراخيص الأجهزة وبصمة الدخول الرقمية لمنع مشاركة الحسابات وحماية المحتوى."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/teacher/dashboard' },
          { label: 'أكواد الدخول والأجهزة' },
        ]}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setIssuedResult(null);
              setIssueExpiresAt('');
              setIsIssueModalOpen(true);
            }}
            disabled={!selectedStudentId}
          >
            إصدار كود جديد للطالب
          </Button>
        }
      />

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-success-subtle text-success-subtle-fg border border-success/30'
              : 'bg-danger-subtle text-danger-subtle-fg border border-danger/30'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold px-2" aria-label="إغلاق"><X size={16} strokeWidth={1.75} aria-hidden /></button>
        </div>
      )}

      <CredentialsStats credentials={credentials} totalStudents={students.length} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <CredentialsStudentSidebar
            students={students}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
            search={searchStudent}
            onSearchChange={setSearchStudent}
            loading={loadingStudents}
          />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div>
                <h3 className="text-sm font-bold text-fg">
                  الأكواد والأجهزة المرتبطة: {currentStudent?.user?.name || 'اختر طالباً'}
                </h3>
                <p className="text-xs text-fg-muted mt-0.5">
                  كود الدخول صالح لجهاز واحد فقط ببصمة رقمية مشفرة.
                </p>
              </div>
            </div>

            <CredentialsTable
              credentials={credentials}
              loading={loadingCreds}
              onOpenIssueModal={() => {
                setIssuedResult(null);
                setIssueExpiresAt('');
                setIsIssueModalOpen(true);
              }}
              onReplaceDevice={(c) => {
                setReplacingCred(c);
                setReplaceReason('');
              }}
              onRevoke={(c) => {
                setRevokingCred(c);
                setRevokeReason('');
              }}
              onCopyCode={copyToClipboard}
            />
          </Card>
        </div>
      </div>

      <IssueCredentialModal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        student={currentStudent}
        expiresAt={issueExpiresAt}
        onExpiresAtChange={setIssueExpiresAt}
        onConfirm={handleIssueCredential}
        isLoading={isIssuing}
        issuedResult={issuedResult}
        onCopyCode={copyToClipboard}
      />

      <ReplaceDeviceModal
        cred={replacingCred}
        isOpen={Boolean(replacingCred)}
        onClose={() => setReplacingCred(null)}
        replaceReason={replaceReason}
        onReplaceReasonChange={setReplaceReason}
        onConfirm={handleReplaceDevice}
        isLoading={isReplacing}
      />

      <RevokeCredentialModal
        cred={revokingCred}
        isOpen={Boolean(revokingCred)}
        onClose={() => setRevokingCred(null)}
        revokeReason={revokeReason}
        onRevokeReasonChange={setRevokeReason}
        onConfirm={handleRevokeCredential}
        isLoading={isRevoking}
      />
    </div>
  );
}
