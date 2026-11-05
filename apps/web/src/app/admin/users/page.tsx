'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { DataState } from '../../../components/ui/data-state';
import { UsersIcon, ShieldIcon } from '../../../components/icons';
import { adminApi, type UserSummary, type ParentProfileItem } from '../../../lib/admin-api';
import type { ApiMeta } from '../../../lib/api-client';

import { Check, Import, KeyRound, MessageSquare, Plus, Unlink, UserPlus, Users, X, AlertTriangle } from 'lucide-react';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [personaTab, setPersonaTab] = useState<'all' | 'student' | 'staff' | 'parent' | 'unlinked'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Unlinked students
  const [unlinkedStudents, setUnlinkedStudents] = useState<any[]>([]);
  const [unlinkedCount, setUnlinkedCount] = useState<number>(0);

  // Password reset modal state
  const [resetModalUser, setResetModalUser] = useState<UserSummary | null>(null);
  const [resetResult, setResetResult] = useState<{ temporary_password: string } | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Link child to parent modal (F-10)
  const [linkChildParent, setLinkChildParent] = useState<{ id: string; name: string } | null>(null);
  const [allStudents, setAllStudents] = useState<{ id: string; name: string; student_code: string }[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [linkRelationType, setLinkRelationType] = useState('father');
  const [isLinkingChild, setIsLinkingChild] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Link parent to unlinked student modal (OD-33)
  const [linkParentStudent, setLinkParentStudent] = useState<{ id: string; name: string } | null>(null);
  const [parentsList, setParentsList] = useState<ParentProfileItem[]>([]);
  const [parentLinkMode, setParentLinkMode] = useState<'existing' | 'new'>('new');
  const [selectedParentId, setSelectedParentId] = useState('');
  const [newParentName, setNewParentName] = useState('');
  const [newParentPhone, setNewParentPhone] = useState('');
  const [newRelationType, setNewRelationType] = useState('father');
  const [isLinkingParent, setIsLinkingParent] = useState(false);
  const [parentLinkError, setParentLinkError] = useState<string | null>(null);

  const fetchUnlinkedStudents = useCallback(async () => {
    try {
      const res = await adminApi.getStudentsWithoutParent();
      setUnlinkedStudents(res.students || []);
      setUnlinkedCount((res.students || []).length);
    } catch {
      // Non-blocking
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    if (personaTab === 'unlinked') {
      try {
        setLoading(true);
        setError(null);
        const res = await adminApi.getStudentsWithoutParent();
        setUnlinkedStudents(res.students || []);
        setUnlinkedCount((res.students || []).length);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'فشل تحميل قائمة الطلاب بدون ولي أمر');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.getUsers({
        persona: personaTab === 'all' ? undefined : personaTab,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchQuery.trim() || undefined,
        page: currentPage,
      });
      setUsers(res.users);
      setMeta(res.meta);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل تحميل قائمة المستخدمين');
    } finally {
      setLoading(false);
    }
  }, [personaTab, statusFilter, searchQuery, currentPage]);

  useEffect(() => {
    fetchUsers();
    fetchUnlinkedStudents();
  }, [fetchUsers, fetchUnlinkedStudents]);

  const handleResetPassword = async () => {
    if (!resetModalUser) return;
    setIsResetting(true);
    try {
      const res = await adminApi.resetPassword(resetModalUser.id);
      setResetResult({ temporary_password: res.temporary_password });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل إعادة تعيين كلمة المرور');
    } finally {
      setIsResetting(false);
    }
  };

  const handleToggleStatus = async (user: UserSummary) => {
    if (user.persona === 'student' && user.student?.id) {
      try {
        if (user.status === 'active') {
          await adminApi.suspendStudent(user.student.id);
        } else {
          await adminApi.activateStudent(user.student.id);
        }
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' } : u
          )
        );
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'فشل تغيير حالة الطالب');
      }
    } else {
      alert('إيقاف/تفعيل هذا النوع من المستخدمين غير مدعوم مباشرة، يرجى التعديل من صفحة المستخدم.');
    }
  };

  // Open link child modal for parent (F-10)
  const openLinkChildModal = async (parentId: string, parentName: string) => {
    setLinkChildParent({ id: parentId, name: parentName });
    setSelectedStudentId('');
    setLinkRelationType('father');
    setLinkError(null);
    try {
      const res = await adminApi.getUsers({ persona: 'student', per_page: 100 });
      setAllStudents(
        res.users
          .filter((u) => u.student?.id)
          .map((u) => ({
            id: u.student!.id,
            name: u.name,
            student_code: u.student!.student_code,
          }))
      );
    } catch {
      setLinkError('فشل تحميل قائمة الطلاب للاختيار.');
    }
  };

  const handleLinkChildSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkChildParent || !selectedStudentId) return;

    setIsLinkingChild(true);
    setLinkError(null);
    try {
      await adminApi.linkParentChild(linkChildParent.id, {
        student_id: selectedStudentId,
        relation_type: linkRelationType,
      });
      setLinkChildParent(null);
      await fetchUsers();
      await fetchUnlinkedStudents();
    } catch (err: unknown) {
      setLinkError(err instanceof Error ? err.message : 'فشل ربط الطالب بولي الأمر.');
    } finally {
      setIsLinkingChild(false);
    }
  };

  const handleUnlinkChild = async (parentId: string, studentId: string, studentName: string) => {
    if (!confirm(`هل أنت متأكد من فك ربط الطالب "${studentName}" من ولي الأمر هذا؟`)) {
      return;
    }

    try {
      await adminApi.unlinkParentChild(parentId, studentId);
      await fetchUsers();
      await fetchUnlinkedStudents();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل فك ربط الطالب.');
    }
  };

  const handleToggleWhatsAppOptIn = async (parentId: string, currentOptIn: boolean) => {
    try {
      await adminApi.setParentWhatsAppOptIn(parentId, !currentOptIn);
      await fetchUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل تحديث حالة الواتساب.');
    }
  };

  // Open link parent modal for unlinked student
  const openLinkParentModal = async (studentId: string, studentName: string) => {
    setLinkParentStudent({ id: studentId, name: studentName });
    setParentLinkMode('new');
    setSelectedParentId('');
    setNewParentName('');
    setNewParentPhone('');
    setNewRelationType('father');
    setParentLinkError(null);

    try {
      const res = await adminApi.getParents();
      setParentsList(res.parents || []);
    } catch {
      // Non-blocking
    }
  };

  const handleLinkParentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkParentStudent) return;

    setIsLinkingParent(true);
    setParentLinkError(null);

    try {
      if (parentLinkMode === 'existing') {
        if (!selectedParentId) {
          throw new Error('يرجى اختيار ولي الأمر من القائمة.');
        }
        await adminApi.linkParentChild(selectedParentId, {
          student_id: linkParentStudent.id,
          relation_type: newRelationType,
        });
      } else {
        if (!newParentName.trim() || !newParentPhone.trim()) {
          throw new Error('اسم ورقم هاتف ولي الأمر مطلوبان.');
        }
        await adminApi.createParent({
          name: newParentName.trim(),
          phone: newParentPhone.trim(),
          children: [
            {
              student_id: linkParentStudent.id,
              relation_type: newRelationType,
            },
          ],
        });
      }

      setLinkParentStudent(null);
      await fetchUnlinkedStudents();
      await fetchUsers();
    } catch (err: unknown) {
      setParentLinkError(err instanceof Error ? err.message : 'فشل ربط ولي الأمر.');
    } finally {
      setIsLinkingParent(false);
    }
  };

  const personaLabels: Record<string, string> = {
    student: 'طالب',
    staff: 'كادر تعليمي / إداري',
    parent: 'ولي أمر',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg tracking-tight flex items-center gap-2">
            <UsersIcon size={24} className="text-primary" />
            إدارة المستخدمين والحسابات
          </h1>
          <p className="text-sm text-secondary mt-1">
            إدارة جميع حسابات الطلاب، المعلمين، المشرفين، وأولياء الأمور وروابط الأسر (OD-33).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/students/import"
            className="inline-flex items-center gap-2 bg-card border border-border hover:bg-card/80 text-fg font-medium px-4 py-2.5 rounded-lg text-xs transition-all"
          >
            <Import size={16} strokeWidth={1.75} aria-hidden />
            <span>استيراد جماعي (CSV)</span>
          </Link>
          <Link
            href="/admin/users/new"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-fg font-medium px-4 py-2.5 rounded-lg text-xs transition-all shadow-lg shadow-primary/30 active:scale-95"
          >
            <Plus size={16} strokeWidth={1.75} aria-hidden />
            <span>إضافة مستخدم جديد</span>
          </Link>
        </div>
      </div>

      {/* Tabs and Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Persona Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-background rounded-lg border border-border text-xs overflow-x-auto">
            <button
              onClick={() => {
                setPersonaTab('all');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                personaTab === 'all'
                  ? 'bg-primary text-primary-fg shadow-sm'
                  : 'text-secondary hover:text-fg'
              }`}
            >
              الجميع
            </button>
            <button
              onClick={() => {
                setPersonaTab('student');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                personaTab === 'student'
                  ? 'bg-primary text-primary-fg shadow-sm'
                  : 'text-secondary hover:text-fg'
              }`}
            >
              الطلاب
            </button>
            <button
              onClick={() => {
                setPersonaTab('staff');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                personaTab === 'staff'
                  ? 'bg-primary text-primary-fg shadow-sm'
                  : 'text-secondary hover:text-fg'
              }`}
            >
              الكادر الإداري والتعليمي
            </button>
            <button
              onClick={() => {
                setPersonaTab('parent');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                personaTab === 'parent'
                  ? 'bg-primary text-primary-fg shadow-sm'
                  : 'text-secondary hover:text-fg'
              }`}
            >
              أولياء الأمور
            </button>
            <button
              onClick={() => {
                setPersonaTab('unlinked');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                personaTab === 'unlinked'
                  ? 'bg-warning text-warning-fg shadow-sm'
                  : 'text-secondary hover:text-fg'
              }`}
            >
              <span>طلاب بدون ولي أمر</span>
              {unlinkedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-danger text-danger-fg text-xs font-bold">
                  {unlinkedCount}
                </span>
              )}
            </button>
          </div>

          {/* Search & Status Filters */}
          {personaTab !== 'unlinked' && (
            <div className="flex items-center gap-3">
              <select
                aria-label="تصفية حسب الحالة"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-surface border border-border rounded-lg px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-colors cursor-pointer font-medium"
              >
                <option className="bg-surface text-fg py-1.5" value="all">كل الحالات</option>
                <option className="bg-surface text-fg py-1.5" value="active">نشط فقط</option>
                <option className="bg-surface text-fg py-1.5" value="suspended">موقوف مؤقتاً</option>
              </select>

              <div className="w-56">
                <input
                  type="text"
                  placeholder="بحث بالاسم أو الهاتف أو البريد..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Main Table */}
      <Card className="p-6">
        {loading ? (
          <DataState state="loading" message="جارٍ تحميل بيانات المستخدمين..." />
        ) : error ? (
          <DataState state="error" message={error} onRetry={fetchUsers} />
        ) : personaTab === 'unlinked' ? (
          /* Unlinked Students View (OD-33) */
          <div>
            <div className="mb-4 p-4 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-3 text-xs text-fg">
              <AlertTriangle className="text-warning shrink-0 mt-0.5" size={18} />
              <div>
                <span className="font-bold block text-warning mb-1">
                  قائمة الطلاب غير المربوطين بولي أمر (OD-33)
                </span>
                <p className="text-secondary leading-relaxed">
                  بناءً على المتطلبات الصارمة لمنصة الصحابة، يجب ربط كل طالب بولي أمر لاستلام إشعارات الحضور والواجبات والدرجات ورسائل الواتساب. يمكنك ربط كل طالب بولي أمر مسجل مسبقاً أو تسجيل ولي أمر جديد مباشرة.
                </p>
              </div>
            </div>

            {unlinkedStudents.length === 0 ? (
              <div className="text-center py-12 text-secondary text-xs">
                ممتاز! جميع الطلاب في المؤسسة مربوطون بأولياء أمورهم.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-border text-secondary font-semibold">
                      <th className="py-3 px-3">كود الطالب</th>
                      <th className="py-3 px-3">اسم الطالب</th>
                      <th className="py-3 px-3">رقم الهاتف</th>
                      <th className="py-3 px-3">المرحلة الدراسية</th>
                      <th className="py-3 px-3 text-center">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {unlinkedStudents.map((st) => (
                      <tr key={st.id} className="hover:bg-card/40 transition-colors">
                        <td className="py-3 px-3 font-mono font-medium text-fg">
                          {st.student_code}
                        </td>
                        <td className="py-3 px-3 font-semibold text-fg">
                          {st.user?.name || '—'}
                        </td>
                        <td className="py-3 px-3 font-mono text-secondary" dir="ltr">
                          {st.user?.phone || '—'}
                        </td>
                        <td className="py-3 px-3 text-secondary">
                          {st.grade_level || '—'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => openLinkParentModal(st.id, st.user?.name || st.student_code)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-primary hover:bg-primary-hover text-primary-fg font-medium transition-colors"
                          >
                            <UserPlus size={14} />
                            <span>ربط ولي أمر</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-secondary text-xs">
            لم يتم العثور على أي مستخدمين يطابقون خيارات البحث الحالية.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-border text-secondary font-semibold">
                  <th className="py-3 px-3">المستخدم</th>
                  <th className="py-3 px-3">النوع</th>
                  <th className="py-3 px-3">بيانات الربط والأسرة (OD-33)</th>
                  <th className="py-3 px-3">الحالة</th>
                  <th className="py-3 px-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => {
                  const parentProfile = user.parent_profile || (user.persona === 'parent' ? user.parent : null);
                  const linkedStudents = user.parent_profile?.students || user.children || [];
                  const parentOptIn = user.parent?.whatsapp_opt_in ?? user.parent_profile?.whatsapp_opt_in ?? true;

                  return (
                    <tr key={user.id} className="hover:bg-card/40 transition-colors">
                      <td className="py-4 px-3">
                        <div className="font-semibold text-fg text-sm">{user.name}</div>
                        <div className="text-secondary text-xs font-mono mt-0.5">
                          {user.email || user.phone || 'بدون بيانات اتصال'}
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <Badge
                          variant={
                            user.persona === 'student'
                              ? 'info'
                              : user.persona === 'staff'
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {personaLabels[user.persona] || user.persona}
                        </Badge>
                      </td>
                      <td className="py-4 px-3">
                        {user.persona === 'student' && (
                          <div className="space-y-1">
                            <div className="text-xs text-secondary">
                              كود: <span className="font-mono text-fg font-medium">{user.student?.student_code || '—'}</span>
                              {user.student?.grade_level ? ` • ${user.student.grade_level}` : ''}
                            </div>
                            {user.parents && user.parents.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="text-xs text-secondary">ولي الأمر:</span>
                                {user.parents.map((p) => (
                                  <span key={p.id} className="text-xs text-fg font-medium bg-surface px-1.5 py-0.5 rounded-xs border border-border">
                                    {p.name} ({p.phone || 'بدون هاتف'})
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-warning bg-warning/10 px-1.5 py-0.5 rounded-xs border border-warning/20">
                                  بدون ولي أمر
                                </span>
                                {user.student?.id && (
                                  <button
                                    onClick={() => openLinkParentModal(user.student!.id, user.name)}
                                    className="text-xs text-primary hover:underline font-medium"
                                  >
                                    + ربط ولي أمر
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {user.persona === 'parent' && (
                          <div className="space-y-2">
                            {/* WhatsApp Status Toggle */}
                            {user.parent?.id && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleWhatsAppOptIn(user.parent!.id, parentOptIn)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                                    parentOptIn
                                      ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                                      : 'bg-muted border-border text-secondary hover:text-fg'
                                  }`}
                                  title="تغيير موافقة استقبال إشعارات الواتساب"
                                >
                                  <MessageSquare size={12} />
                                  <span>{parentOptIn ? 'الواتساب: مفعّل' : 'الواتساب: معطّل'}</span>
                                </button>
                              </div>
                            )}

                            {/* Linked Children & Actions (F-10) */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs text-secondary">الأبناء:</span>
                              {linkedStudents.length === 0 ? (
                                <span className="text-xs text-secondary">لا يوجد أبناء مربوطون حالياً</span>
                              ) : (
                                linkedStudents.map((child: any) => (
                                  <span
                                    key={child.id}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-surface border border-border text-fg text-xs"
                                  >
                                    <span>{child.user?.name || child.name} ({child.student_code})</span>
                                    {user.parent?.id && (
                                      <button
                                        type="button"
                                        onClick={() => handleUnlinkChild(user.parent!.id, child.id, child.user?.name || child.name)}
                                        className="text-danger hover:text-danger-hover p-0.5 rounded-xs"
                                        title="فك ربط الطالب من ولي الأمر"
                                      >
                                        <Unlink size={12} />
                                      </button>
                                    )}
                                  </span>
                                ))
                              )}
                              {user.parent?.id && (
                                <button
                                  type="button"
                                  onClick={() => openLinkChildModal(user.parent!.id, user.name)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-card border border-border hover:bg-surface text-primary text-xs font-medium transition-colors"
                                >
                                  <Plus size={12} />
                                  <span>ربط طالب</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {user.persona === 'staff' && (
                          <div className="flex flex-wrap gap-1">
                            {user.roles && user.roles.length > 0 ? (
                              user.roles.map((r) => (
                                <span
                                  key={r.id}
                                  className="px-1.5 py-0.5 rounded-xs bg-warning/10 border border-warning/20 text-warning text-xs"
                                >
                                  {r.display_name}
                                </span>
                              ))
                            ) : (
                              <span className="text-secondary text-xs">
                                {user.staff?.staff_type || 'كادر'}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-3">
                        {user.status === 'active' ? (
                          <Badge variant="success">نشط</Badge>
                        ) : (
                          <Badge variant="danger">موقوف</Badge>
                        )}
                      </td>
                      <td className="py-4 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="px-2.5 py-1 bg-card border border-border hover:bg-background text-secondary hover:text-fg rounded-sm text-xs font-medium transition-colors"
                          >
                            عرض الملف
                          </Link>
                          <button
                            onClick={() => {
                              setResetModalUser(user);
                              setResetResult(null);
                            }}
                            className="px-2.5 py-1 bg-warning/10 border border-warning/20 hover:bg-warning/20 text-warning rounded-sm text-xs font-medium transition-colors inline-flex items-center gap-1"
                            title="إعادة تعيين كلمة المرور"
                          >
                            <KeyRound size={14} strokeWidth={1.75} aria-hidden />
                            <span>كلمة المرور</span>
                          </button>
                          {user.persona === 'student' && (
                            <button
                              onClick={() => handleToggleStatus(user)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                user.status === 'active'
                                  ? 'bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20'
                                  : 'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20'
                              }`}
                            >
                              {user.status === 'active' ? 'إيقاف' : 'تفعيل'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {personaTab !== 'unlinked' && meta?.pagination && meta.pagination.last_page > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-border text-xs text-secondary">
            <div>
              الصفحة {meta.pagination.page} من {meta.pagination.last_page} (إجمالي{' '}
              {meta.pagination.total} مستخدم)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-sm border border-border bg-card text-fg disabled:opacity-40"
              >
                السابق
              </button>
              <button
                disabled={currentPage >= meta.pagination.last_page}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-sm border border-border bg-card text-fg disabled:opacity-40"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal 1: Link Child to Parent (F-10) */}
      {linkChildParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-fg">ربط طالب بولي الأمر</h3>
                  <p className="text-xs text-secondary mt-0.5">{linkChildParent.name}</p>
                </div>
              </div>
              <button
                onClick={() => setLinkChildParent(null)}
                className="text-secondary hover:text-fg p-1 rounded-sm"
                aria-label="إغلاق"
              >
                <X size={16} strokeWidth={1.75} aria-hidden />
              </button>
            </div>

            <form onSubmit={handleLinkChildSubmit} className="py-4 space-y-4">
              {linkError && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-md text-danger text-xs">
                  {linkError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">
                  اختر الطالب المراد ربطه *
                </label>
                <select
                  aria-label="اختر الطالب"
                  required
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                >
                  <option value="">-- اختر طالباً من القائمة --</option>
                  {allStudents.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.student_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">
                  صلة القرابة
                </label>
                <select
                  aria-label="صلة القرابة"
                  value={linkRelationType}
                  onChange={(e) => setLinkRelationType(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                >
                  <option value="father">أب (Father)</option>
                  <option value="mother">أم (Mother)</option>
                  <option value="guardian">ولي أمر / وصي (Guardian)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setLinkChildParent(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-secondary hover:text-fg transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isLinkingChild || !selectedStudentId}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-fg transition-all disabled:opacity-50"
                >
                  {isLinkingChild ? 'جارٍ الربط...' : 'تأكيد الربط'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Link Parent to Unlinked Student (OD-33) */}
      {linkParentStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-fg">ربط ولي أمر للطالب</h3>
                  <p className="text-xs text-secondary mt-0.5">{linkParentStudent.name}</p>
                </div>
              </div>
              <button
                onClick={() => setLinkParentStudent(null)}
                className="text-secondary hover:text-fg p-1 rounded-sm"
                aria-label="إغلاق"
              >
                <X size={16} strokeWidth={1.75} aria-hidden />
              </button>
            </div>

            <form onSubmit={handleLinkParentSubmit} className="py-4 space-y-4">
              {parentLinkError && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-md text-danger text-xs">
                  {parentLinkError}
                </div>
              )}

              {/* Mode Selector */}
              <div className="flex items-center gap-2 p-1 bg-background rounded-lg border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setParentLinkMode('new')}
                  className={`flex-1 py-1.5 rounded-sm font-medium transition-colors ${
                    parentLinkMode === 'new'
                      ? 'bg-primary text-primary-fg'
                      : 'text-secondary hover:text-fg'
                  }`}
                >
                  تسجيل ولي أمر جديد
                </button>
                <button
                  type="button"
                  onClick={() => setParentLinkMode('existing')}
                  className={`flex-1 py-1.5 rounded-sm font-medium transition-colors ${
                    parentLinkMode === 'existing'
                      ? 'bg-primary text-primary-fg'
                      : 'text-secondary hover:text-fg'
                  }`}
                >
                  اختيار ولي أمر مسجل
                </button>
              </div>

              {parentLinkMode === 'existing' ? (
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">
                    اختر ولي الأمر من القائمة *
                  </label>
                  <select
                    aria-label="اختر ولي الأمر"
                    required
                    value={selectedParentId}
                    onChange={(e) => setSelectedParentId(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                  >
                    <option value="">-- اختر ولي أمر مسجل --</option>
                    {parentsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.user.name} ({p.user.phone || 'بدون هاتف'})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1">
                      اسم ولي الأمر الكامل *
                    </label>
                    <input
                      aria-label="اسم ولي الأمر"
                      type="text"
                      required
                      placeholder="مثال: يوسف خليل"
                      value={newParentName}
                      onChange={(e) => setNewParentName(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1">
                      رقم هاتف ولي الأمر (واتساب) *
                    </label>
                    <input
                      aria-label="رقم هاتف ولي الأمر"
                      type="tel"
                      required
                      placeholder="0501234567"
                      value={newParentPhone}
                      onChange={(e) => setNewParentPhone(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">
                  صلة القرابة
                </label>
                <select
                  aria-label="صلة القرابة"
                  value={newRelationType}
                  onChange={(e) => setNewRelationType(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                >
                  <option value="father">أب (Father)</option>
                  <option value="mother">أم (Mother)</option>
                  <option value="guardian">ولي أمر / وصي (Guardian)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setLinkParentStudent(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-secondary hover:text-fg transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isLinkingParent}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-fg transition-all disabled:opacity-50"
                >
                  {isLinkingParent ? 'جارٍ الحفظ...' : 'حفظ وربط ولي الأمر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-warning/20 border border-warning/30 flex items-center justify-center text-warning">
                  <ShieldIcon size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-fg">إعادة تعيين كلمة المرور</h3>
                  <p className="text-xs text-secondary mt-0.5">{resetModalUser.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setResetModalUser(null);
                  setResetResult(null);
                }}
                className="text-secondary hover:text-fg p-1 rounded-sm"
                aria-label="إغلاق"
              >
                <X size={16} strokeWidth={1.75} aria-hidden />
              </button>
            </div>

            <div className="py-6 space-y-4">
              {!resetResult ? (
                <>
                  <p className="text-xs text-secondary leading-relaxed">
                    سيتم توليد كلمة مرور مؤقتة صالحة للاستخدام الفوري لهذا المستخدم. يمكنك نسخها وتسليمها له مباشرة.
                  </p>
                  <div className="p-3 bg-background rounded-md border border-border text-xs space-y-1">
                    <div>
                      <span className="text-secondary">اسم المستخدم: </span>
                      <span className="text-fg font-medium">{resetModalUser.name}</span>
                    </div>
                    <div>
                      <span className="text-secondary">البريد / الهاتف: </span>
                      <span className="text-fg font-mono">
                        {resetModalUser.email || resetModalUser.phone || '—'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-md text-center space-y-2">
                    <p className="text-xs text-primary font-semibold">
                      تم توليد كلمة المرور المؤقتة بنجاح:
                    </p>
                    <div className="text-lg font-mono font-bold text-fg bg-background/80 py-2 px-3 rounded-sm border border-border select-all">
                      {resetResult.temporary_password}
                    </div>
                  </div>
                  <p className="text-xs text-secondary text-center">
                    يرجى تزويد المستخدم بهذه الكلمة ومطالبته بتغييرها عند تسجيل الدخول الأول.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              {!resetResult ? (
                <>
                  <button
                    type="button"
                    onClick={() => setResetModalUser(null)}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-secondary hover:text-fg transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={isResetting}
                    onClick={handleResetPassword}
                    className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-warning hover:bg-warning text-warning-fg transition-all disabled:opacity-50"
                  >
                    {isResetting ? 'جارٍ التوليد...' : 'توليد كلمة المرور الآن'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setResetModalUser(null);
                    setResetResult(null);
                  }}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-primary text-primary-fg"
                >
                  تم الانتهاء
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
