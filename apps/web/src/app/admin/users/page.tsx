'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { DataState } from '../../../components/ui/data-state';
import { UsersIcon, ShieldIcon } from '../../../components/icons';
import { adminApi, type UserSummary } from '../../../lib/admin-api';
import type { ApiMeta } from '../../../lib/api-client';

import { Import, KeyRound, Plus, X } from 'lucide-react';
export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [personaTab, setPersonaTab] = useState<'all' | 'student' | 'staff' | 'parent'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Password reset modal state
  const [resetModalUser, setResetModalUser] = useState<UserSummary | null>(null);
  const [resetResult, setResetResult] = useState<{ temporary_password: string } | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const fetchUsers = useCallback(async () => {
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
  }, [fetchUsers]);

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
            إدارة جميع حسابات الطلاب، المعلمين، المشرفين، وأولياء الأمور في المؤسسة.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/students/import"
            className="inline-flex items-center gap-2 bg-card border border-border hover:bg-card/80 text-fg font-medium px-4 py-2.5 rounded-lg text-xs transition-all"
          >
            <span><Import size={16} strokeWidth={1.75} aria-hidden /></span>
            <span>استيراد جماعي (CSV)</span>
          </Link>
          <Link
            href="/admin/users/new"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-fg font-medium px-4 py-2.5 rounded-lg text-xs transition-all shadow-lg shadow-primary/30 active:scale-95"
          >
            <span><Plus size={16} strokeWidth={1.75} aria-hidden /></span>
            <span>إضافة مستخدم جديد</span>
          </Link>
        </div>
      </div>

      {/* Tabs and Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Persona Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-background rounded-lg border border-border text-xs">
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
          </div>

          {/* Search & Status Filters */}
          <div className="flex items-center gap-3">
            <select
              aria-label="تصفية حسب الحالة"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
            >
              <option value="all">كل الحالات</option>
              <option value="active">نشط فقط</option>
              <option value="suspended">موقوف مؤقتاً</option>
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
        </div>
      </Card>

      {/* Main Table */}
      <Card className="p-6">
        {loading ? (
          <DataState state="loading" message="جارٍ تحميل بيانات المستخدمين..." />
        ) : error ? (
          <DataState state="error" message={error} onRetry={fetchUsers} />
        ) : users.length === 0 ? (
          <DataState
            state="empty"
            message="لا يوجد مستخدمون يطابقون شروط البحث أو الفلترة المحددة."
          />
        ) : (
          <div tabIndex={0} className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border text-secondary">
                <tr>
                  <th className="pb-3 px-3">المستخدم</th>
                  <th className="pb-3 px-3">النوع (Persona)</th>
                  <th className="pb-3 px-3">بيانات الاتصال</th>
                  <th className="pb-3 px-3">المستوى / الدور</th>
                  <th className="pb-3 px-3">الحالة</th>
                  <th className="pb-3 px-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-card/40 transition-colors">
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-fg">{user.name}</div>
                          <div className="text-xs text-secondary font-mono">
                            ID: {user.id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-card border border-border text-secondary">
                        {personaLabels[user.persona] || user.persona}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-secondary">
                      <div>{user.phone || '—'}</div>
                      <div className="text-xs text-fg-muted font-mono">{user.email || '—'}</div>
                    </td>
                    <td className="py-4 px-3">
                      {user.persona === 'student' && (
                        <div className="text-secondary">
                          <span className="font-mono text-primary font-semibold">
                            {user.student?.student_code || '—'}
                          </span>
                          {user.student?.grade_level && (
                            <span className="text-xs text-secondary block">
                              الصف: {user.student.grade_level}
                            </span>
                          )}
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
                      {user.persona === 'parent' && (
                        <span className="text-secondary text-xs">
                          {user.parent?.national_id ? `هوية: ${user.parent.national_id}` : 'ولي أمر'}
                        </span>
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
                          className="px-2.5 py-1 bg-warning/10 border border-warning/20 hover:bg-warning/20 text-warning rounded-sm text-xs font-medium transition-colors"
                          title="إعادة تعيين كلمة المرور"
                        >
                          
 <KeyRound size={16} strokeWidth={1.75} aria-hidden /> كلمة المرور
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
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {meta?.pagination && meta.pagination.last_page > 1 && (
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
               aria-label="إغلاق">
                
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

