'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Card } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Modal } from '../../../../components/ui/modal';
import { DataState } from '../../../../components/ui/data-state';
import { UsersIcon, ShieldIcon, CheckCircleIcon, CreditCardIcon } from '../../../../components/icons';
import { adminApi, type UserDetail, type RoleItem } from '../../../../lib/admin-api';
import {
  billingApi,
  type SubscriptionItem,
  type EntitlementItem,
} from '../../../../lib/billing-api';

import { Check, KeyRound, X } from 'lucide-react';
import { IconBack } from '../../../../components/icons/directional';
import { formatDate } from '../../../../lib/format';
import { partial } from '../../../../lib/partial-failure';
export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [user, setUser] = useState<UserDetail | null>(null);
  const [effectivePermissions, setEffectivePermissions] = useState<string[]>([]);
  const [allRoles, setAllRoles] = useState<RoleItem[]>([]);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Password reset state
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Role saving state
  const [savingRoles, setSavingRoles] = useState(false);
  const [roleSaveSuccess, setRoleSaveSuccess] = useState(false);

  // Student Billing & Entitlements state
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [entitlements, setEntitlements] = useState<EntitlementItem[]>([]);
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [grantForm, setGrantForm] = useState({ entitlement_key: '', expires_at: '', reason: '' });
  const [revokeTarget, setRevokeTarget] = useState<EntitlementItem | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isSubmittingBilling, setIsSubmittingBilling] = useState(false);

  const loadUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [userData, permissionsData, rolesData, userRolesData] = await Promise.all([
        adminApi.getUser(id),
        adminApi.getUserEffectivePermissions(id).catch(partial(({ effective_permissions: [] }))),
        adminApi.getRoles().catch(partial([])),
        adminApi.getUserRoles(id).catch(partial(({ roles: [] }))),
      ]);

      setUser(userData);
      setEffectivePermissions(permissionsData.effective_permissions);
      setAllRoles(rolesData);
      setUserRoles(userRolesData.roles.map((r) => r.name));

      if (userData.persona === 'student' && userData.student) {
        const [subs, ents] = await Promise.all([
          billingApi.getStudentSubscriptions(userData.student.id).catch(partial([])),
          billingApi.getStudentEntitlements(userData.student.id).catch(partial([])),
        ]);
        setSubscriptions(subs);
        setEntitlements(ents);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل تحميل بيانات المستخدم');
    } finally {
      setLoading(false);
    }
  };

  const handleGrantEntitlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.student || !grantForm.entitlement_key || !grantForm.reason) return;
    try {
      setIsSubmittingBilling(true);
      await billingApi.grantEntitlement(user.student.id, {
        entitlement_key: grantForm.entitlement_key.trim(),
        expires_at: grantForm.expires_at ? new Date(grantForm.expires_at).toISOString() : null,
        reason: grantForm.reason.trim(),
      });
      setIsGrantModalOpen(false);
      setGrantForm({ entitlement_key: '', expires_at: '', reason: '' });
      const ents = await billingApi.getStudentEntitlements(user.student.id);
      setEntitlements(ents);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل منح الصلاحية');
    } finally {
      setIsSubmittingBilling(false);
    }
  };

  const handleRevokeEntitlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeTarget || !revokeReason.trim()) return;
    try {
      setIsSubmittingBilling(true);
      await billingApi.revokeEntitlement(revokeTarget.id, revokeReason.trim());
      setRevokeTarget(null);
      setRevokeReason('');
      if (user?.student) {
        const ents = await billingApi.getStudentEntitlements(user.student.id);
        setEntitlements(ents);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل إلغاء الصلاحية');
    } finally {
      setIsSubmittingBilling(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, [id]);

  const handleResetPassword = async () => {
    setIsResettingPassword(true);
    setTempPassword(null);
    try {
      const res = await adminApi.resetPassword(id);
      setTempPassword(res.temporary_password);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل إعادة تعيين كلمة المرور');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleToggleRole = (roleName: string) => {
    setUserRoles((prev) =>
      prev.includes(roleName) ? prev.filter((r) => r !== roleName) : [...prev, roleName]
    );
  };

  const handleSaveRoles = async () => {
    setSavingRoles(true);
    setRoleSaveSuccess(false);
    try {
      await adminApi.updateUserRoles(id, userRoles);
      setRoleSaveSuccess(true);
      const permRes = await adminApi.getUserEffectivePermissions(id);
      setEffectivePermissions(permRes.effective_permissions);
      setTimeout(() => setRoleSaveSuccess(false), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل حفظ الأدوار');
    } finally {
      setSavingRoles(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12">
        <DataState state="loading" message="جارٍ تحميل ملف المستخدم والصلاحيات..." />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="py-12">
        <DataState state="error" message={error || 'المستخدم غير موجود'} onRetry={loadUserData} />
      </div>
    );
  }

  const personaArabic: Record<string, string> = {
    student: 'طالب',
    staff: 'كادر تعليمي / إداري',
    parent: 'ولي أمر',
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link href="/admin/users" className="text-xs text-secondary hover:text-fg">
            
 <IconBack size={16} /> العودة لقائمة المستخدمين
 </Link>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-2xl">
              {user.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-fg tracking-tight">{user.name}</h1>
                <Badge variant={user.status === 'active' ? 'success' : 'danger'}>
                  {user.status === 'active' ? 'نشط' : 'موقوف'}
                </Badge>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-card border border-border text-secondary">
                  {personaArabic[user.persona] || user.persona}
                </span>
              </div>
              <p className="text-xs text-secondary mt-1 font-mono">
                معرف النظام: {user.id} • تاريخ التسجيل: {formatDate(user.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetPassword}
              disabled={isResettingPassword}
              className="px-3 py-2 bg-warning/10 border border-warning/20 hover:bg-warning/20 text-warning rounded-md text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {isResettingPassword ? 'جارٍ التوليد...' : <><KeyRound size={16} strokeWidth={1.75} aria-hidden /> إعادة تعيين كلمة المرور</>}
            </button>
          </div>
        </div>
      </div>

      {/* Temporary Password Notification */}
      {tempPassword && (
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 text-fg space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-warning">
              
 <KeyRound size={16} strokeWidth={1.75} aria-hidden /> تم توليد كلمة مرور مؤقتة صالحة للاستخدام:
 </span>
            <button onClick={() => setTempPassword(null)} className="text-xs text-secondary hover:text-fg">
              
 <X size={16} strokeWidth={1.75} aria-hidden /> إغلاق
 </button>
          </div>
          <div className="p-3 bg-background rounded-sm border border-border flex items-center justify-between">
            <span className="font-mono text-base font-bold text-warning select-all">{tempPassword}</span>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(tempPassword);
                alert('تم نسخ كلمة المرور إلى الحافظة.');
              }}
              className="text-xs px-2.5 py-1 bg-card border border-border rounded-xs text-secondary hover:text-fg"
            >
              نسخ
            </button>
          </div>
        </div>
      )}

      {/* Grid: Profile Details & Roles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile & Academic Info */}
        <div className="space-y-6 lg:col-span-1">
          {/* Contact & Identity */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-fg border-b border-border pb-2 flex items-center gap-2">
              <UsersIcon size={16} className="text-primary" />
              البيانات الشخصية والاتصال
            </h2>

            <div className="space-y-2.5 text-xs">
              <div>
                <span className="text-secondary block">البريد الإلكتروني:</span>
                <span className="text-fg font-mono">{user.email || 'غير مسجل'}</span>
              </div>
              <div>
                <span className="text-secondary block">رقم الهاتف:</span>
                <span className="text-fg font-mono" dir="ltr">{user.phone || 'غير مسجل'}</span>
              </div>
              <div>
                <span className="text-secondary block">الفرع المنتسب:</span>
                <span className="text-fg font-medium">
                  {user.branch?.name ? `${user.branch.name} (${user.branch.code})` : 'الفرع الرئيسي'}
                </span>
              </div>
              {user.persona === 'student' && user.student && (
                <>
                  <div className="pt-2 border-t border-border">
                    <span className="text-secondary block">كود الطالب:</span>
                    <span className="text-primary font-mono font-bold text-sm">
                      {user.student.student_code}
                    </span>
                  </div>
                  <div>
                    <span className="text-secondary block">الصف الدراسي:</span>
                    <span className="text-fg">{user.student.grade_level || 'غير محدد'}</span>
                  </div>
                </>
              )}
              {user.persona === 'staff' && user.staff && (
                <div className="pt-2 border-t border-border">
                  <span className="text-secondary block">التصنيف الوظيفي:</span>
                  <span className="text-warning font-medium">{user.staff.staff_type}</span>
                </div>
              )}
              {user.persona === 'parent' && user.parent && (
                <div className="pt-2 border-t border-border">
                  <span className="text-secondary block">الرقم القومي:</span>
                  <span className="text-fg font-mono">{user.parent.national_id || 'غير مسجل'}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Associations (Children or Parents) */}
          {user.persona === 'student' && user.parents && user.parents.length > 0 && (
            <Card className="p-5 space-y-3">
              <h2 className="text-sm font-bold text-fg border-b border-border pb-2">
                أولياء الأمور المرتبطون
              </h2>
              <div className="space-y-2">
                {user.parents.map((p) => (
                  <div key={p.id} className="p-2.5 rounded-sm bg-background border border-border text-xs">
                    <div className="font-semibold text-fg">{p.name}</div>
                    <div className="text-secondary text-xs font-mono mt-0.5">{p.phone || '—'}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {user.persona === 'parent' && user.children && user.children.length > 0 && (
            <Card className="p-5 space-y-3">
              <h2 className="text-sm font-bold text-fg border-b border-border pb-2">
                الأبناء المرتبطون بهذا الحساب
              </h2>
              <div className="space-y-2">
                {user.children.map((c) => (
                  <div key={c.id} className="p-2.5 rounded-sm bg-background border border-border text-xs flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-fg">{c.name}</div>
                      <div className="text-primary font-mono text-xs">{c.student_code}</div>
                    </div>
                    <Link href={`/admin/users/${c.id}`} className="text-xs text-secondary hover:text-fg">
                      عرض
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Roles & Effective Permissions */}
        <div className="space-y-6 lg:col-span-2">
          {/* Roles Assignment Card */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-fg flex items-center gap-2">
                  <ShieldIcon size={16} className="text-warning" />
                  الأدوار المسندة للمستخدم (Roles Assignment)
                </h2>
                <p className="text-xs text-secondary mt-0.5">
                  تعيين الأدوار يمنح المستخدم حزمة من الصلاحيات التلقائية في النظام.
                </p>
              </div>
              <button
                onClick={handleSaveRoles}
                disabled={savingRoles}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg rounded-md text-xs font-semibold shadow-md transition-all disabled:opacity-50"
              >
                {savingRoles ? 'جارٍ الحفظ...' : 'حفظ الأدوار'}
              </button>
            </div>

            {roleSaveSuccess && (
              <div className="p-2.5 rounded-sm bg-primary/10 border border-primary/20 text-primary text-xs flex items-center gap-2">
                <CheckCircleIcon size={14} />
                <span>تم تحديث أدوار المستخدم بنجاح!</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {allRoles.map((role) => {
                const isAssigned = userRoles.includes(role.name);
                return (
                  <button
                    type="button"
                    key={role.id}
                    onClick={() => handleToggleRole(role.name)}
                    className={`p-3 rounded-xl border text-right text-xs transition-all flex flex-col justify-between ${
                      isAssigned
                        ? 'bg-warning/10 border-warning/30 text-warning'
                        : 'bg-background border-border text-secondary hover:text-fg hover:border-border-strong'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-fg">{role.display_name}</span>
                      <span className="font-mono text-xs">{isAssigned ? <Check size={16} strokeWidth={1.75} aria-hidden /> : '+'}</span>
                    </div>
                    <span className="text-xs text-secondary mt-1 block">
                      {role.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Effective Permissions (Computed by Backend) */}
          <Card className="p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-fg flex items-center gap-2">
                <ShieldIcon size={16} className="text-primary" />
                الصلاحيات الفعلية المحسوبة (Effective Permissions)
              </h2>
              <p className="text-xs text-secondary mt-0.5">
                تجميع لكافة الصلاحيات الممنوحة لهذا المستخدم عبر جميع أدواره (Master §11).
              </p>
            </div>

            {effectivePermissions.length === 0 ? (
              <p className="text-xs text-secondary py-4 text-center">
                لا توجد صلاحيات مسندة لهذا المستخدم حالياً.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-72 overflow-y-auto p-1">
                {effectivePermissions.map((perm) => (
                  <span
                    key={perm}
                    className="px-2.5 py-1 rounded-sm bg-background border border-border text-fg text-xs font-mono"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* Student Billing & Entitlements Section (R3-4, R3-6) */}
          {user.persona === 'student' && user.student && (
            <Card className="p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <h2 className="text-sm font-bold text-fg flex items-center gap-2">
                    <CreditCardIcon size={16} className="text-turquoise" />
                    الاشتراكات وصلاحيات الوصول الأكاديمية (Entitlements)
                  </h2>
                  <p className="text-xs text-secondary mt-0.5">
                    إدارة الباقات المفعلة وحقوق الوصول للمقررات مع تدقيق كامل لمنح وإلغاء الصلاحيات.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsGrantModalOpen(true)}
                >
                  + منح صلاحية يدوية
                </Button>
              </div>

              {/* Subscriptions */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-fg">الباقات والاشتراكات السارية:</div>
                {subscriptions.length === 0 ? (
                  <p className="text-xs text-secondary py-2">لا توجد باقات اشتراك مفعلة لهذا الطالب.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {subscriptions.map((sub) => (
                      <div
                        key={sub.id}
                        className="p-3 rounded-md bg-background border border-border text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-fg">
                            {sub.package?.name || 'باقة دراسية'}
                          </span>
                          <Badge variant={sub.status === 'active' ? 'success' : 'neutral'}>
                            {sub.status === 'active' ? 'نشط' : sub.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-secondary flex justify-between">
                          <span>البدء: {sub.starts_at ? formatDate(sub.starts_at) : 'فوري'}</span>
                          <span>الانتهاء: {sub.ends_at ? formatDate(sub.ends_at) : 'غير محدد'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Entitlements Table */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="text-xs font-bold text-fg">صلاحيات الوصول الفردية (Entitlements):</div>
                {entitlements.length === 0 ? (
                  <p className="text-xs text-secondary py-2">لا توجد صلاحيات فردية مسندة لهذا الطالب.</p>
                ) : (
                  <div tabIndex={0} className="overflow-x-auto">
                    <table className="w-full text-start text-xs">
                      <thead className="bg-card/60 border-b border-border text-secondary">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">مفتاح الصلاحية</th>
                          <th className="py-2.5 px-3 font-semibold">سبب المنح</th>
                          <th className="py-2.5 px-3 font-semibold">تاريخ الانتهاء</th>
                          <th className="py-2.5 px-3 font-semibold text-center">إجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {entitlements.map((ent) => (
                          <tr key={ent.id} className="hover:bg-card/40">
                            <td className="py-2.5 px-3 font-mono text-turquoise font-semibold">
                              {ent.entitlement_key}
                            </td>
                            <td className="py-2.5 px-3 text-secondary text-xs">
                              {ent.reason || 'تفعيل تلقائي عبر اشتراك باقة'}
                            </td>
                            <td className="py-2.5 px-3 text-secondary font-mono text-xs">
                              {ent.expires_at ? formatDate(ent.expires_at) : 'دائم'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => {
                                  setRevokeTarget(ent);
                                  setRevokeReason('');
                                }}
                                className="text-danger hover:text-danger text-xs font-medium"
                                title="إلغاء الصلاحية"
                              >
                                إلغاء الصلاحية
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Modal: Grant Entitlement */}
      <Modal
        isOpen={isGrantModalOpen}
        onClose={() => {
          if (!isSubmittingBilling) setIsGrantModalOpen(false);
        }}
        title="منح صلاحية أكاديمية يدوياً للطالب"
        subtitle="يتم تسجيل سبب المنح وهوية المشرف في سجل تدقيق العمليات (Audit Log)."
        size="md"
      >
        <form onSubmit={handleGrantEntitlement} className="space-y-4 py-2 text-xs">
          <div>
            <label className="text-fg font-medium mb-1 block">
              مفتاح الصلاحية (Entitlement Key) *
            </label>
            <Input
              required
              placeholder="مثال: ONLINE_ACCESS أو all_courses أو course:UUID"
              value={grantForm.entitlement_key}
              onChange={(e) => setGrantForm({ ...grantForm, entitlement_key: e.target.value })}
            />
            <div className="flex gap-2 mt-1.5">
              {['ONLINE_ACCESS', 'all_courses'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setGrantForm({ ...grantForm, entitlement_key: preset })}
                  className="px-2 py-0.5 rounded-xs text-xs bg-card border border-border text-secondary hover:text-fg"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-fg font-medium mb-1 block">
              تاريخ انتهاء الصلاحية (اختياري)
            </label>
            <Input
              type="date"
              value={grantForm.expires_at}
              onChange={(e) => setGrantForm({ ...grantForm, expires_at: e.target.value })}
            />
          </div>

          <div>
            <label className="text-fg font-medium mb-1 block">
              سبب المنح (إلزامي للتدقيق والرقابة) *
            </label>
            <Input
              required
              placeholder="مثال: منحة دراسية للمتفوقين / تعويض عن عطل تقني / سداد يدوي"
              value={grantForm.reason}
              onChange={(e) => setGrantForm({ ...grantForm, reason: e.target.value })}
            />
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsGrantModalOpen(false)}
              disabled={isSubmittingBilling}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isSubmittingBilling}
              isLoading={isSubmittingBilling}
            >
              تأكيد ومنح الصلاحية
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Revoke Entitlement */}
      <Modal
        isOpen={Boolean(revokeTarget)}
        onClose={() => {
          if (!isSubmittingBilling) setRevokeTarget(null);
        }}
        title="إلغاء صلاحية أكاديمية"
        subtitle="سيتم إلغاء وصول الطالب فوراً وإدراج سبب الإلغاء بسجل التدقيق."
        size="sm"
      >
        <form onSubmit={handleRevokeEntitlement} className="space-y-4 py-2 text-xs">
          <p className="text-secondary">
            هل أنت متأكد من إلغاء صلاحية{' '}
            <span className="font-mono text-turquoise font-bold">{revokeTarget?.entitlement_key}</span>؟
          </p>

          <div>
            <label className="text-fg font-medium mb-1 block">
              سبب الإلغاء (إلزامي للرقابة) *
            </label>
            <Input
              required
              placeholder="مثال: انتهاء فترة المنحة / إلغاء اشتراك بطلب ولي الأمر"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
            />
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setRevokeTarget(null)}
              disabled={isSubmittingBilling}
            >
              رجوع
            </Button>
            <Button
              variant="danger"
              type="submit"
              disabled={isSubmittingBilling}
              isLoading={isSubmittingBilling}
            >
              تأكيد الإلغاء
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

