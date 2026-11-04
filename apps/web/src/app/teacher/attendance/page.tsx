'use client';

/**
 * R7A — Teacher Attendance Management Page
 * Modularized into features/attendance/components (< 180 lines).
 */

import React, { useEffect, useState } from 'react';
import { attendanceApi } from '../../../lib/attendance-api';
import { educationApi } from '../../../lib/education-api';
import type { SchoolClass, ClassSession, Student } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { PageHeader } from '../../../components/ui/page-header';
import { Select } from '../../../components/ui/select';
import { QrCodeIcon } from '../../../components/icons';
import { AttendanceRoster } from '../../../features/attendance/components/attendance-roster';
import {
  LiveQrScannerModal,
  CheckedInStudent,
} from '../../../features/attendance/components/live-qr-scanner-modal';

import { formatDate, formatTime } from '../../../lib/format';
import { partial } from '../../../lib/partial-failure';
export default function TeacherAttendancePage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [recordSuccess, setRecordSuccess] = useState<string | null>(null);

  const [activeQrSession, setActiveQrSession] = useState<ClassSession | null>(null);
  const [liveAttendees, setLiveAttendees] = useState<CheckedInStudent[]>([]);
  const [scannedCode, setScannedCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [cList, stList] = await Promise.all([
          attendanceApi.getClasses().catch(partial([])),
          educationApi.getStudents().catch(partial([])),
        ]);
        setClasses(cList);
        setStudents(stList);

        if (cList.length > 0) {
          setSelectedClassId(cList[0].id);
          const sList = await attendanceApi.getSessions(cList[0].id).catch(partial([]));
          setSessions(sList);
          if (sList.length > 0) setSelectedSessionId(sList[0].id);
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleClassChange = async (classId: string) => {
    setSelectedClassId(classId);
    try {
      const sList = await attendanceApi.getSessions(classId);
      setSessions(sList);
      if (sList.length > 0) setSelectedSessionId(sList[0].id);
      else setSelectedSessionId('');
    } catch {
      setSessions([]);
      setSelectedSessionId('');
    }
  };

  const handleRecord = async (
    sessionId: string,
    studentId: string,
    status: 'present' | 'absent' | 'late' | 'excused'
  ) => {
    try {
      await attendanceApi.recordAttendance(sessionId, {
        student_id: studentId,
        status,
        attendance_mode: 'manual',
      });
      setRecordSuccess(
        `تم تحديث حالة الحضور إلى: ${
          status === 'present' ? 'حاضر' : status === 'late' ? 'متأخر' : 'غائب'
        }`
      );
      setTimeout(() => setRecordSuccess(null), 3000);
    } catch {
      alert('حدث خطأ أثناء رصد الحضور.');
    }
  };

  const handleRealScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedCode.trim() || !activeQrSession) return;

    setIsScanning(true);
    try {
      const res = await attendanceApi.scanQr(activeQrSession.id, scannedCode.trim());
      const newStudent: CheckedInStudent = {
        name: res.student?.name || (res.student as any)?.user?.name || 'طالب غير معروف',
        code: res.student?.student_code || scannedCode.trim(),
        time: formatTime(new Date()),
        mode: 'مسح إلكتروني QR',
      };
      setLiveAttendees((prev) => [newStudent, ...prev]);
      setRecordSuccess(`تم تسجيل حضور الطالب ${newStudent.name} بنجاح!`);
      setScannedCode('');
      setTimeout(() => setRecordSuccess(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل تسجيل كود الحضور');
    } finally {
      setIsScanning(false);
    }
  };

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || null;

  return (
    <div className="space-y-6 text-start">
      <PageHeader
        title="كشوف وسجلات حضور الطلاب"
        description="تسجيل الحضور اليدوي والرقمي عبر الباركود الآمن وربط الغيابات بالحصص الدراسية."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/teacher/dashboard' },
          { label: 'الحصص والحضور' },
        ]}
        actions={
          selectedSession && (
            <Button
              variant="primary"
              onClick={() => setActiveQrSession(selectedSession)}
              className="flex items-center gap-2"
            >
              <QrCodeIcon size={16} />
              <span>فتح مسح QR السريع</span>
            </Button>
          )
        }
      />

      {recordSuccess && (
        <div className="p-3 rounded-sm text-xs font-semibold bg-success-subtle text-success-subtle-fg border border-success/30">
          {recordSuccess}
        </div>
      )}

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="اختر الفصل / المجموعة"
            value={selectedClassId}
            onChange={(e) => handleClassChange(e.target.value)}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            label="اختر الجلسة الدراسية"
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            options={sessions.map((s) => ({
              value: s.id,
              label: `${formatDate(s.session_date || s.starts_at)} — ${s.status}`,
            }))}
            disabled={sessions.length === 0}
          />
        </div>

        <AttendanceRoster
          students={students}
          session={selectedSession}
          onRecord={handleRecord}
        />
      </Card>

      <LiveQrScannerModal
        session={activeQrSession}
        isOpen={Boolean(activeQrSession)}
        onClose={() => setActiveQrSession(null)}
        scannedCode={scannedCode}
        onScannedCodeChange={setScannedCode}
        onScanSubmit={handleRealScanSubmit}
        isScanning={isScanning}
        liveAttendees={liveAttendees}
        recordSuccess={recordSuccess}
      />
    </div>
  );
}
