'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { attendanceApi } from '../../../lib/attendance-api';
import { adminApi } from '../../../lib/admin-api';
import type { Branch, SchoolClass } from '../../../types';
import { CalendarIcon, PlusIcon, SearchIcon, BuildingIcon, UsersIcon, IconBack } from '../../../components/icons';

import { X } from 'lucide-react';
import { partial } from '../../../lib/partial-failure';
import { useAuth } from '../../../context/auth-context';
export default function TeacherClassesPage() {
  const { permissions } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  // Modal State
  const [isCreating, setIsCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newBranchId, setNewBranchId] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [classList, branchList] = await Promise.all([
        attendanceApi.getClasses(),
        ('branches.manage' in permissions ? adminApi.getBranches().catch(partial([])) : Promise.resolve([])),
      ]);
      setClasses(classList);
      setBranches(branchList);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'تعذر تحميل المجموعات والفصول الدراسية.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setSubmitting(true);
      await attendanceApi.createClass({
        name: newName.trim(),
        code: newCode.trim() || undefined,
        branch_id: newBranchId || undefined,
        status: 'active',
      });
      setNewName('');
      setNewCode('');
      setNewBranchId('');
      setIsCreating(false);
      await loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'تعذر إنشاء المجموعة الدراسية.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredClasses = classes.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.code && c.code.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesBranch =
      selectedBranch === 'all' || c.branch_id === selectedBranch;

    return matchesSearch && matchesBranch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <UsersIcon size={24} className="text-primary" />
            إدارة المجموعات والفصول الدراسية
          </h1>
          <p className="text-sm text-secondary mt-1">
            أنشئ المجموعات الحضورية، عيّن الفروع والقاعات، قيد الطلاب، وجدول الحصص والجلسات.
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-2 bg-primary hover:opacity-90 text-primary-foreground font-semibold px-4 py-2.5 rounded-lg text-xs transition-opacity shadow-md shadow-primary/20 shrink-0"
        >
          <PlusIcon size={16} />
          إنشاء مجموعة جديدة
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl shadow-sm">
        <div className="relative w-full sm:w-80">
          <SearchIcon size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الكود..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-lg ps-9 pe-3 py-2 text-xs text-foreground placeholder:text-secondary/60 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
          />
        </div>

        {branches.length > 0 && (
          <div className="w-full sm:w-auto">
            <select
              aria-label="تصفية حسب الفرع"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full sm:w-48 bg-surface border border-border rounded-lg px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-colors cursor-pointer font-medium"
            >
              <option className="bg-surface text-fg py-1.5" value="all">جميع الفروع والمراكز</option>
              {branches.map((b) => (
                <option className="bg-surface text-fg py-1.5" key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-20 text-center text-secondary text-sm">
          <div className="inline-block animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-3" />
          <p>جارٍ تحميل المجموعات الدراسية...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredClasses.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-card border border-border">
          <UsersIcon size={40} className="mx-auto text-secondary/40 mb-3" />
          <h3 className="text-base font-bold text-foreground">لا توجد مجموعات دراسية</h3>
          <p className="text-xs text-secondary mt-1">
            {searchQuery || selectedBranch !== 'all'
              ? 'لم يتم العثور على مجموعات مطابقة لمعايير البحث.'
              : 'ابدأ بإنشاء أول مجموعة حضورية وقيد الطلاب بها.'}
          </p>
          {!searchQuery && selectedBranch === 'all' && (
            <button
              onClick={() => setIsCreating(true)}
              className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg text-xs hover:opacity-90"
            >
              <PlusIcon size={14} />
              إنشاء مجموعة جديدة
            </button>
          )}
        </div>
      )}

      {/* Classes Grid */}
      {!loading && !error && filteredClasses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClasses.map((cls) => {
            const studentsCount = cls.students?.length ?? 0;
            const sessionsCount = cls.sessions?.length ?? 0;

            return (
              <div
                key={cls.id}
                className="flex flex-col justify-between rounded-2xl bg-card border border-border p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all group"
              >
                <div>
                  {/* Badges Bar */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-bold text-primary px-2.5 py-1 rounded-sm bg-primary/10 border border-primary/20">
                      {cls.code || 'CLASS'}
                    </span>
                    {cls.branch && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-border flex items-center gap-1">
                        <BuildingIcon size={11} />
                        {cls.branch.name}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {cls.name}
                  </h3>

                  {/* Teacher info */}
                  {cls.teacher?.user && (
                    <div className="mt-2 text-xs text-secondary">
                      المعلم: <strong className="text-foreground">{cls.teacher.user.name}</strong>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border/60 text-xs text-secondary">
                    <div className="flex items-center gap-1.5">
                      <UsersIcon size={14} className="text-secondary/60" />
                      <span>{studentsCount} طالب مقيد</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon size={14} className="text-secondary/60" />
                      <span>{sessionsCount} جلسة مجدولة</span>
                    </div>
                  </div>
                </div>

                {/* Card Action */}
                <div className="mt-5 pt-4 border-t border-border">
                  <Link
                    href={`/teacher/classes/${cls.id}`}
                    className="w-full inline-flex items-center justify-center gap-1.5 bg-primary hover:opacity-90 text-primary-foreground font-semibold px-3 py-2 rounded-lg text-xs transition-opacity shadow-sm"
                  >
                    إدارة المجموعة والطلاب
                    <IconBack size={13} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Class Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <UsersIcon size={18} className="text-primary" />
                إنشاء مجموعة دراسية جديدة
              </h2>
              <button
                onClick={() => setIsCreating(false)}
                className="text-secondary hover:text-foreground text-sm font-semibold p-1"
               aria-label="إغلاق">
                
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">
                  اسم المجموعة <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: فيزياء - السبت والأربعاء 4 عصراً"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">كود المجموعة</label>
                <input aria-label="كود المجموعة"
                  type="text"
                  placeholder="مثال: PHY-G12-SAT"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {branches.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">الفرع / المركز</label>
                  <select aria-label="الفرع / المركز"
                    value={newBranchId}
                    onChange={(e) => setNewBranchId(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-3.5 py-2 text-xs text-fg focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-colors cursor-pointer font-medium"
                  >
                    <option className="bg-surface text-fg py-1.5" value="">بدون تحديد فرع</option>
                    {branches.map((b) => (
                      <option className="bg-surface text-fg py-1.5" key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-lg border border-border text-xs text-secondary hover:text-foreground hover:bg-background transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-primary hover:opacity-90 text-primary-foreground font-semibold text-xs transition-opacity shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'جارٍ الإنشاء...' : 'حفظ وإنشاء'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
