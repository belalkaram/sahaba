'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { DataState } from '../../../components/ui/data-state';
import { CalendarIcon } from '../../../components/icons';
import { adminApi, type Branch, type Classroom } from '../../../lib/admin-api';

import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { formatNumber } from '../../../lib/format';
export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingClassrooms, setLoadingClassrooms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Branch Modal
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchFormData, setBranchFormData] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    is_active: true,
  });

  // Classroom Modal
  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
  const [classroomFormData, setClassroomFormData] = useState({
    name: '',
    code: '',
    capacity: 30,
    room_type: 'قاعة تدريس عامة',
    is_active: true,
  });

  const loadBranches = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getBranches();
      setBranches(data);
      if (data.length > 0 && !selectedBranch) {
        setSelectedBranch(data[0]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل تحميل الفروع');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (!selectedBranch) return;
    const loadClassrooms = async () => {
      try {
        setLoadingClassrooms(true);
        const rooms = await adminApi.getBranchClassrooms(selectedBranch.id);
        setClassrooms(rooms);
      } catch {
        setClassrooms([]);
      } finally {
        setLoadingClassrooms(false);
      }
    };
    loadClassrooms();
  }, [selectedBranch]);

  // Branch CRUD handlers
  const handleOpenBranchModal = (branch?: Branch) => {
    if (branch) {
      setEditingBranch(branch);
      setBranchFormData({
        name: branch.name,
        code: branch.code,
        address: branch.address || '',
        phone: branch.phone || '',
        is_active: branch.is_active,
      });
    } else {
      setEditingBranch(null);
      setBranchFormData({
        name: '',
        code: '',
        address: '',
        phone: '',
        is_active: true,
      });
    }
    setIsBranchModalOpen(true);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBranch) {
        const updated = await adminApi.updateBranch(editingBranch.id, branchFormData);
        setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
        if (selectedBranch?.id === updated.id) setSelectedBranch(updated);
      } else {
        const created = await adminApi.createBranch(branchFormData);
        setBranches((prev) => [...prev, created]);
        setSelectedBranch(created);
      }
      setIsBranchModalOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل حفظ الفرع');
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الفرع؟')) return;
    try {
      await adminApi.deleteBranch(branchId);
      setBranches((prev) => prev.filter((b) => b.id !== branchId));
      if (selectedBranch?.id === branchId) {
        setSelectedBranch(branches.find((b) => b.id !== branchId) || null);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل حذف الفرع');
    }
  };

  // Classroom CRUD handlers
  const handleOpenClassroomModal = (room?: Classroom) => {
    if (room) {
      setEditingClassroom(room);
      setClassroomFormData({
        name: room.name,
        code: room.code || '',
        capacity: room.capacity,
        room_type: room.room_type,
        is_active: room.is_active,
      });
    } else {
      setEditingClassroom(null);
      setClassroomFormData({
        name: '',
        code: '',
        capacity: 30,
        room_type: 'قاعة تدريس عامة',
        is_active: true,
      });
    }
    setIsClassroomModalOpen(true);
  };

  const handleSaveClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return;
    try {
      if (editingClassroom) {
        const updated = await adminApi.updateClassroom(editingClassroom.id, classroomFormData);
        setClassrooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await adminApi.createClassroom(selectedBranch.id, classroomFormData);
        setClassrooms((prev) => [...prev, created]);
      }
      setIsClassroomModalOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل حفظ القاعة');
    }
  };

  const handleDeleteClassroom = async (roomId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه القاعة؟')) return;
    try {
      await adminApi.deleteClassroom(roomId);
      setClassrooms((prev) => prev.filter((r) => r.id !== roomId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل حذف القاعة');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg tracking-tight flex items-center gap-2">
            <CalendarIcon size={24} className="text-primary" />
            إدارة الفروع والمقرات والقاعات (Branches & Classrooms)
          </h1>
          <p className="text-sm text-secondary mt-1">
            إدارة المراكز التعليمية، الفروع الجغرافية، والقاعات الدراسية وسعتها الاستيعابية (Offline Module).
          </p>
        </div>

        <button
          onClick={() => handleOpenBranchModal()}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-fg font-medium px-4 py-2.5 rounded-lg text-xs transition-all shadow-lg shadow-primary/30 active:scale-95"
        >
          <span><Plus size={16} strokeWidth={1.75} aria-hidden /></span>
          <span>إضافة فرع جديد</span>
        </button>
      </div>

      {loading ? (
        <DataState state="loading" message="جارٍ تحميل الفروع والقاعات..." />
      ) : error ? (
        <DataState state="error" message={error} onRetry={loadBranches} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Branches List Column */}
          <div className="space-y-4 lg:col-span-1">
            <h2 className="text-sm font-bold text-fg flex items-center justify-between">
              <span>قائمة الفروع ({formatNumber(branches.length)})</span>
            </h2>

            {branches.length === 0 ? (
              <Card className="p-6 text-center text-xs text-secondary">
                لا توجد فروع مسجلة. انقر على &quot;إضافة فرع جديد&quot; للبدء.
              </Card>
            ) : (
              <div className="space-y-2.5">
                {branches.map((b) => {
                  const isSelected = selectedBranch?.id === b.id;
                  return (
                    <Card
                      key={b.id}
                      onClick={() => setSelectedBranch(b)}
                      className={`p-4 cursor-pointer transition-all border ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-md'
                          : 'border-border bg-card/60 hover:border-border-strong'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-fg text-sm flex items-center gap-2">
                            <span>{b.name}</span>
                            <span className="text-xs font-mono text-primary px-1.5 py-0.5 rounded-xs bg-primary/10">
                              {b.code}
                            </span>
                          </div>
                          {b.address && (
                            <p className="text-xs text-secondary mt-1">{b.address}</p>
                          )}
                          {b.phone && (
                            <p className="text-xs text-fg-muted font-mono mt-0.5" dir="ltr">
                              {b.phone}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenBranchModal(b);
                            }}
                            className="p-1 text-secondary hover:text-fg text-xs"
                            title="تعديل الفرع"
                          >
                            
 <Pencil size={16} strokeWidth={1.75} aria-hidden />
 </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBranch(b.id);
                            }}
                            className="p-1 text-secondary hover:text-danger text-xs"
                            title="حذف الفرع"
                          >
                            
 <Trash2 size={16} strokeWidth={1.75} aria-hidden />
 </button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Classrooms for Selected Branch Column */}
          <div className="space-y-4 lg:col-span-2">
            {selectedBranch ? (
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h2 className="text-base font-bold text-fg flex items-center gap-2">
                      <span>قاعات فرع: {selectedBranch.name}</span>
                      <span className="font-mono text-xs text-primary font-bold">
                        ({selectedBranch.code})
                      </span>
                    </h2>
                    <p className="text-xs text-secondary mt-0.5">
                      القاعات التدريسية والمختبرات المرتبطة بهذا الفرع
                    </p>
                  </div>
                  <button
                    onClick={() => handleOpenClassroomModal()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-fg text-xs font-semibold shadow-md transition-all"
                  >
                    <span><Plus size={16} strokeWidth={1.75} aria-hidden /></span>
                    <span>إضافة قاعة للفرع</span>
                  </button>
                </div>

                {loadingClassrooms ? (
                  <DataState state="loading" message="جارٍ تحميل قاعات هذا الفرع..." />
                ) : classrooms.length === 0 ? (
                  <DataState
                    state="empty"
                    message="لا توجد قاعات مضافة لهذا الفرع بعد. يمكنك إضافة قاعة الآن."
                  />
                ) : (
                  <div tabIndex={0} className="overflow-x-auto">
                    <table className="w-full text-start text-xs">
                      <thead className="border-b border-border text-secondary">
                        <tr>
                          <th className="pb-3 px-3">اسم القاعة</th>
                          <th className="pb-3 px-3">الكود</th>
                          <th className="pb-3 px-3">السعة الاستيعابية</th>
                          <th className="pb-3 px-3">نوع القاعة</th>
                          <th className="pb-3 px-3">الحالة</th>
                          <th className="pb-3 px-3 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {classrooms.map((room) => (
                          <tr key={room.id} className="hover:bg-card/40 transition-colors">
                            <td className="py-3 px-3 font-semibold text-fg">
                              {room.name}
                            </td>
                            <td className="py-3 px-3 font-mono text-primary">
                              {room.code || '—'}
                            </td>
                            <td className="py-3 px-3 text-fg">
                              <span className="font-bold">{room.capacity}</span> مقعد
                            </td>
                            <td className="py-3 px-3 text-secondary">
                              {room.room_type}
                            </td>
                            <td className="py-3 px-3">
                              {room.is_active ? (
                                <Badge variant="success">نشطة</Badge>
                              ) : (
                                <Badge variant="danger">معطلة</Badge>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleOpenClassroomModal(room)}
                                  className="px-2 py-1 bg-card border border-border hover:bg-background text-secondary hover:text-fg rounded-xs text-xs"
                                >
                                  تعديل
                                </button>
                                <button
                                  onClick={() => handleDeleteClassroom(room.id)}
                                  className="px-2 py-1 bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 rounded-xs text-xs"
                                >
                                  حذف
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-8 text-center text-secondary text-sm">
                اختر فرعاً من القائمة الجانبية لعرض قاعاته وإدارتها.
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Branch Modal */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h3 className="text-base font-bold text-fg">
                {editingBranch ? 'تعديل بيانات الفرع' : 'إضافة فرع جديد'}
              </h3>
              <button onClick={() => setIsBranchModalOpen(false)} className="text-secondary hover:text-fg p-1" aria-label="إغلاق">
                
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
            </div>

            <form onSubmit={handleSaveBranch} className="py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">اسم الفرع *</label>
                <input aria-label="اسم الفرع"
                  type="text"
                  required
                  placeholder="مثال: فرع مدينة نصر"
                  value={branchFormData.name}
                  onChange={(e) => setBranchFormData({ ...branchFormData, name: e.target.value })}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">كود الفرع *</label>
                <input aria-label="كود الفرع"
                  type="text"
                  required
                  placeholder="NASR-01"
                  value={branchFormData.code}
                  onChange={(e) =>
                    setBranchFormData({ ...branchFormData, code: e.target.value.toUpperCase() })
                  }
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">العنوان بالتفصيل</label>
                <input aria-label="العنوان بالتفصيل"
                  type="text"
                  placeholder="شارع عباس العقاد، عمارة 15"
                  value={branchFormData.address}
                  onChange={(e) => setBranchFormData({ ...branchFormData, address: e.target.value })}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">رقم الهاتف</label>
                <input aria-label="رقم الهاتف"
                  type="tel"
                  placeholder="01012345678"
                  value={branchFormData.phone}
                  onChange={(e) => setBranchFormData({ ...branchFormData, phone: e.target.value })}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary font-mono"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  className="px-4 py-2 rounded-md text-xs text-secondary hover:text-fg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-md text-xs font-semibold bg-primary text-primary-fg"
                >
                  {editingBranch ? 'تحديث الفرع' : 'إضافة الفرع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Classroom Modal */}
      {isClassroomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h3 className="text-base font-bold text-fg">
                {editingClassroom ? 'تعديل القاعة' : 'إضافة قاعة تدريسية'}
              </h3>
              <button
                onClick={() => setIsClassroomModalOpen(false)}
                className="text-secondary hover:text-fg p-1"
               aria-label="إغلاق">
                
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
            </div>

            <form onSubmit={handleSaveClassroom} className="py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">اسم القاعة *</label>
                <input aria-label="اسم القاعة"
                  type="text"
                  required
                  placeholder="مثال: قاعة الخوارزمي 101"
                  value={classroomFormData.name}
                  onChange={(e) =>
                    setClassroomFormData({ ...classroomFormData, name: e.target.value })
                  }
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">كود القاعة</label>
                  <input aria-label="كود القاعة"
                    type="text"
                    placeholder="R101"
                    value={classroomFormData.code}
                    onChange={(e) =>
                      setClassroomFormData({ ...classroomFormData, code: e.target.value })
                    }
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">
                    السعة (عدد الطلاب) *
                  </label>
                  <input aria-label="السعة (عدد الطلاب)"
                    type="number"
                    min={1}
                    required
                    value={classroomFormData.capacity}
                    onChange={(e) =>
                      setClassroomFormData({
                        ...classroomFormData,
                        capacity: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">نوع القاعة</label>
                <select aria-label="نوع القاعة"
                  value={classroomFormData.room_type}
                  onChange={(e) =>
                    setClassroomFormData({ ...classroomFormData, room_type: e.target.value })
                  }
                  className="w-full bg-surface border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-colors cursor-pointer"
                >
                  <option className="bg-surface text-fg py-1.5" value="قاعة تدريس عامة">قاعة تدريس عامة</option>
                  <option className="bg-surface text-fg py-1.5" value="مختبر حاسوب">مختبر حاسوب</option>
                  <option className="bg-surface text-fg py-1.5" value="مدرج محاضرات كبير">مدرج محاضرات كبير</option>
                  <option className="bg-surface text-fg py-1.5" value="قاعة ورش عمل وتدريب">قاعة ورش عمل وتدريب</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsClassroomModalOpen(false)}
                  className="px-4 py-2 rounded-md text-xs text-secondary hover:text-fg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-md text-xs font-semibold bg-primary text-primary-fg"
                >
                  {editingClassroom ? 'تحديث القاعة' : 'إضافة القاعة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

