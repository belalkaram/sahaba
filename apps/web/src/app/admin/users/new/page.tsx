'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '../../../../components/ui/card';
import { UsersIcon, CheckCircleIcon } from '../../../../components/icons';
import { adminApi, type Branch, type RoleItem } from '../../../../lib/admin-api';

import { Check, GraduationCap, Presentation, Users } from 'lucide-react';
import { IconBack } from '../../../../components/icons/directional';
import { partial } from '../../../../lib/partial-failure';
export default function NewUserPage() {
  const router = useRouter();
  const [persona, setPersona] = useState<'student' | 'staff' | 'parent'>('student');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // External data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);

  useEffect(() => {
    adminApi.getBranches().then(setBranches).catch(partial([]));
    adminApi.getRoles().then(setRoles).catch(partial([]));
  }, []);

  // Shared form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Student specific
  const [studentCode, setStudentCode] = useState('');
  const [gradeLevel, setGradeLevel] = useState('الصف الأول الثانوي');
  const [studentBranchId, setStudentBranchId] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  // Staff specific
  const [staffType, setStaffType] = useState('teacher');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [bio, setBio] = useState('');

  // Parent specific
  const [nationalId, setNationalId] = useState('');
  const [address, setAddress] = useState('');

  const handleRoleToggle = (roleName: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleName) ? prev.filter((r) => r !== roleName) : [...prev, roleName]
    );
  };

  const handleBranchToggle = (branchId: string) => {
    setSelectedBranchIds((prev) =>
      prev.includes(branchId) ? prev.filter((b) => b !== branchId) : [...prev, branchId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      if (persona === 'student') {
        await adminApi.createStudent({
          name,
          phone: phone.trim() || null,
          email: email.trim() || null,
          password: password.trim() || undefined,
          student_code: studentCode.trim() || null,
          grade_level: gradeLevel || null,
          branch_id: studentBranchId || null,
          parent_name: parentName.trim() || null,
          parent_phone: parentPhone.trim() || null,
        });
        setSuccessMessage('تم إنشاء حساب الطالب بنجاح!');
      } else if (persona === 'staff') {
        if (!email.trim()) {
          throw new Error('البريد الإلكتروني إلزامي للكادر التعليمي والإداري.');
        }
        await adminApi.createStaff({
          name,
          email: email.trim(),
          phone: phone.trim() || null,
          password: password.trim() || undefined,
          staff_type: staffType,
          roles: selectedRoles,
          branch_ids: selectedBranchIds,
          bio: bio.trim() || null,
        });
        setSuccessMessage('تم إنشاء حساب الكادر وتعيين الأدوار بنجاح!');
      } else if (persona === 'parent') {
        if (!phone.trim()) {
          throw new Error('رقم الهاتف إلزامي لحساب ولي الأمر.');
        }
        await adminApi.createParent({
          name,
          phone: phone.trim(),
          email: email.trim() || null,
          password: password.trim() || undefined,
          national_id: nationalId.trim() || null,
          address: address.trim() || null,
        });
        setSuccessMessage('تم إنشاء حساب ولي الأمر بنجاح!');
      }

      setTimeout(() => {
        router.push('/admin/users');
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء المستخدم. تحقق من البيانات وأعد المحاولة.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/admin/users" className="text-xs text-secondary hover:text-fg">
            
 <IconBack size={16} /> العودة لقائمة المستخدمين
 </Link>
        </div>
        <h1 className="text-2xl font-bold text-fg tracking-tight flex items-center gap-2">
          <UsersIcon size={24} className="text-primary" />
          إضافة مستخدم جديد
        </h1>
        <p className="text-sm text-secondary mt-1">
          قم بتحديد نوع الحساب وتعبئة البيانات لإنشاء المستخدم ومنحه الصلاحيات المناسبة.
        </p>
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircleIcon size={18} />
          <span>{successMessage} جارٍ التحويل لقائمة المستخدمين...</span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs">
          {error}
        </div>
      )}

      {/* Persona Type Picker */}
      <Card className="p-5">
        <label className="block text-xs font-semibold text-secondary mb-3">
          1. نوع الحساب المطلوب إنشاؤه (Persona) *
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setPersona('student')}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between ${
              persona === 'student'
                ? 'border-primary bg-primary/10 text-fg shadow-md'
                : 'border-border bg-card/60 text-secondary hover:text-fg hover:border-border-strong'
            }`}
          >
            <div className="text-2xl mb-2"><GraduationCap size={24} strokeWidth={1.75} aria-hidden /></div>
            <div>
              <div className="font-bold text-sm text-fg">طالب (Student)</div>
              <div className="text-xs text-secondary mt-0.5">
                حساب للدراسة وحضور الحصص وأداء الواجبات والاختبارات
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPersona('staff')}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between ${
              persona === 'staff'
                ? 'border-primary bg-primary/10 text-fg shadow-md'
                : 'border-border bg-card/60 text-secondary hover:text-fg hover:border-border-strong'
            }`}
          >
            <div className="text-2xl mb-2"><Presentation size={24} strokeWidth={1.75} aria-hidden /></div>
            <div>
              <div className="font-bold text-sm text-fg">كادر تعليمي / إداري (Staff)</div>
              <div className="text-xs text-secondary mt-0.5">
                معلم، مساعد تدريس، مشرف، مسؤول مالي، أو مدير نظام
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPersona('parent')}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between ${
              persona === 'parent'
                ? 'border-primary bg-primary/10 text-fg shadow-md'
                : 'border-border bg-card/60 text-secondary hover:text-fg hover:border-border-strong'
            }`}
          >
            <div className="text-2xl mb-2"><Users size={24} strokeWidth={1.75} aria-hidden /></div>
            <div>
              <div className="font-bold text-sm text-fg">ولي أمر (Parent)</div>
              <div className="text-xs text-secondary mt-0.5">
                متابعة الدرجات، الحضور والغياب، وإيصالات الدفع للأبناء
              </div>
            </div>
          </button>
        </div>
      </Card>

      {/* Main Form */}
      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-6">
          <h2 className="text-base font-bold text-fg border-b border-border pb-3">
            2. البيانات الأساسية للحساب
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1.5">
                الاسم الكامل *
              </label>
              <input aria-label="الاسم الكامل"
                type="text"
                required
                placeholder="مثال: أحمد محمد علي"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary mb-1.5">
                رقم الهاتف {persona === 'parent' ? '*' : '(اختياري)'}
              </label>
              <input
                type="tel"
                required={persona === 'parent'}
                placeholder="01012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary font-mono"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary mb-1.5">
                البريد الإلكتروني {persona === 'staff' ? '*' : '(اختياري)'}
              </label>
              <input
                type="email"
                required={persona === 'staff'}
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary font-mono"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary mb-1.5">
                كلمة المرور الأولية (اختياري - افتراضي: password123)
              </label>
              <input aria-label="كلمة المرور الأولية (اختياري - افتراضي: password123)"
                type="password"
                placeholder="password123"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary font-mono"
              />
            </div>
          </div>

          {/* Student Specific Fields */}
          {persona === 'student' && (
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-base font-bold text-fg">3. بيانات الملف الأكاديمي للطالب</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">
                    كود الطالب (اختياري - يولد تلقائياً)
                  </label>
                  <input aria-label="كود الطالب (اختياري - يولد تلقائياً)"
                    type="text"
                    placeholder="STD-2026-001"
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">
                    الصف / المرحلة الدراسية
                  </label>
                  <select aria-label="الصف / المرحلة الدراسية"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                  >
                    <option value="الصف الأول الثانوي">الصف الأول الثانوي</option>
                    <option value="الصف الثاني الثانوي">الصف الثاني الثانوي</option>
                    <option value="الصف الثالث الثانوي">الصف الثالث الثانوي</option>
                    <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                    <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                    <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">
                    الفرع المنتسب إليه
                  </label>
                  <select aria-label="الفرع المنتسب إليه"
                    value={studentBranchId}
                    onChange={(e) => setStudentBranchId(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                  >
                    <option value="">بدون فرع محدد (الفرع الرئيسي)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Optional Parent Link */}
              <div className="p-4 rounded-lg bg-background/60 border border-border space-y-3">
                <span className="text-xs font-bold text-primary block uppercase">
                  ربط ولي أمر الطالب (اختياري)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-secondary mb-1">اسم ولي الأمر</label>
                    <input aria-label="اسم ولي الأمر"
                      type="text"
                      placeholder="اسم ولي الأمر"
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      className="w-full bg-card border border-border rounded-sm px-3 py-1.5 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-secondary mb-1">هاتف ولي الأمر</label>
                    <input aria-label="هاتف ولي الأمر"
                      type="tel"
                      placeholder="01098765432"
                      value={parentPhone}
                      onChange={(e) => setParentPhone(e.target.value)}
                      className="w-full bg-card border border-border rounded-sm px-3 py-1.5 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Staff Specific Fields */}
          {persona === 'staff' && (
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-base font-bold text-fg">3. تصنيف الكادر وتعيين الأدوار</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">
                    نوع الكادر الوظيفي *
                  </label>
                  <select aria-label="نوع الكادر الوظيفي"
                    value={staffType}
                    onChange={(e) => setStaffType(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                  >
                    <option value="teacher">معلم (Teacher)</option>
                    <option value="teaching_assistant">مساعد تدريس (Teaching Assistant)</option>
                    <option value="supervisor">مشرف تربوي (Supervisor)</option>
                    <option value="finance">مسؤول مالي (Finance)</option>
                    <option value="admin">مدير إداري (Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">
                    نبذة تعريفية (Bio)
                  </label>
                  <input aria-label="نبذة تعريفية (Bio)"
                    type="text"
                    placeholder="مدرس أول لغة عربية وخبير المناهج..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Roles Selection */}
              <div>
                <label className="block text-xs font-semibold text-secondary mb-2">
                  الأدوار والصلاحيات المسندة (Roles)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {roles.map((r) => {
                    const isChecked = selectedRoles.includes(r.name);
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => handleRoleToggle(r.name)}
                        className={`p-2.5 rounded-xl border text-right text-xs transition-colors flex items-center justify-between ${
                          isChecked
                            ? 'bg-warning/10 border-warning/30 text-warning'
                            : 'bg-background border-border text-secondary hover:text-fg'
                        }`}
                      >
                        <span className="font-medium">{r.display_name}</span>
                        <span>{isChecked ? <Check size={16} strokeWidth={1.75} aria-hidden /> : '+'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Branch Assignment */}
              {branches.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-2">
                    الفروع المعين عليها الكادر (Branch Scoping)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {branches.map((b) => {
                      const isChecked = selectedBranchIds.includes(b.id);
                      return (
                        <button
                          type="button"
                          key={b.id}
                          onClick={() => handleBranchToggle(b.id)}
                          className={`p-2.5 rounded-xl border text-right text-xs transition-colors flex items-center justify-between ${
                            isChecked
                              ? 'bg-primary/10 border-primary/30 text-primary'
                              : 'bg-background border-border text-secondary hover:text-fg'
                          }`}
                        >
                          <span>{b.name}</span>
                          <span>{isChecked ? <Check size={16} strokeWidth={1.75} aria-hidden /> : '+'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Parent Specific Fields */}
          {persona === 'parent' && (
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-base font-bold text-fg">3. بيانات الهوية لولي الأمر</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">
                    الرقم القومي / رقم الهوية
                  </label>
                  <input aria-label="الرقم القومي / رقم الهوية"
                    type="text"
                    placeholder="29801011234567"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">
                    العنوان / السكن
                  </label>
                  <input aria-label="العنوان / السكن"
                    type="text"
                    placeholder="القاهرة، مدينة نصر"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Link
              href="/admin/users"
              className="px-4 py-2 rounded-lg text-xs font-medium text-secondary hover:text-fg transition-colors"
            >
              إلغاء
            </Link>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-6 py-2.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-fg transition-all shadow-lg shadow-primary/30 disabled:opacity-50"
            >
              {submitting ? 'جارٍ إنشاء الحساب...' : 'حفظ وإنشاء الحساب'}
            </button>
          </div>
        </Card>
      </form>
    </div>
  );
}

