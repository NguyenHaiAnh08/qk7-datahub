import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Check } from 'lucide-react';
import { lectureService } from '../../services/lectureService';
import { ClassroomBuilding } from '../../types/lecture';
import { toast } from '../common/Toast';

interface Props {
  /** Có quyền thêm/sửa/xóa khu (CLASSROOM_MANAGE). Không có thì chỉ xem. */
  canManage?: boolean;
  /** Gọi sau khi thêm/sửa/xóa khu để trang cha tải lại danh sách khu và phòng học */
  onChanged?: () => void;
}

interface FormState {
  building_code: string;
  building_name: string;
  display_order: string;
  active: boolean;
}

const EMPTY_FORM: FormState = { building_code: '', building_name: '', display_order: '', active: true };

const inputCls =
  'w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60';

export const BuildingManagerPanel: React.FC<Props> = ({ canManage = true, onChanged }) => {
  const [items, setItems] = useState<ClassroomBuilding[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null); // null = đang thêm mới
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lectureService.adminListBuildings();
      setItems(res.items || []);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Không tải được danh sách khu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startCreate = () => {
    const nextOrder = items.length ? Math.max(...items.map((i) => i.display_order)) + 10 : 10;
    setEditingCode(null);
    setForm({ ...EMPTY_FORM, display_order: String(nextOrder) });
    setFormOpen(true);
  };

  const startEdit = (b: ClassroomBuilding) => {
    setEditingCode(b.building_code);
    setForm({
      building_code: b.building_code,
      building_name: b.building_name,
      display_order: String(b.display_order),
      active: b.active,
    });
    setFormOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const order = form.display_order.trim() === '' ? 0 : Number(form.display_order);
      if (editingCode) {
        await lectureService.adminUpdateBuilding(editingCode, {
          building_name: form.building_name.trim(),
          display_order: order,
          active: form.active,
        });
        toast.success('Đã cập nhật khu');
      } else {
        await lectureService.adminCreateBuilding({
          building_code: form.building_code.trim(),
          building_name: form.building_name.trim(),
          display_order: order,
        });
        toast.success('Đã thêm khu mới');
      }
      setFormOpen(false);
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || 'Không lưu được khu');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (code: string) => {
    try {
      await lectureService.adminDeleteBuilding(code);
      toast.success('Đã xóa khu');
      setConfirmDelete(null);
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || 'Không xóa được khu');
      setConfirmDelete(null);
    }
  };

  return (
    <section
      aria-label="Quản lý khu giảng đường"
      className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs"
    >
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Khu hiện trên sơ đồ giám sát; mỗi phòng học được gán vào một khu.
        </p>
        {canManage && (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 px-3.5 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" /> Thêm khu
          </button>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-4">
          {formOpen && (
            <form
              onSubmit={save}
              className="rounded-xl border border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/5 p-4 space-y-3"
            >
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {editingCode ? `Sửa khu ${editingCode}` : 'Thêm khu mới'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mã khu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className={`${inputCls} font-mono uppercase`}
                    value={form.building_code}
                    disabled={!!editingCode}
                    required
                    maxLength={20}
                    pattern="[A-Za-z0-9_\-]{1,20}"
                    title="Chữ, số, gạch ngang hoặc gạch dưới, tối đa 20 ký tự"
                    placeholder="VD: H3"
                    onChange={(e) => setForm({ ...form, building_code: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tên khu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className={inputCls}
                    value={form.building_name}
                    required
                    maxLength={100}
                    placeholder="VD: Khu Giảng đường H3"
                    onChange={(e) => setForm({ ...form, building_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Thứ tự hiển thị
                  </label>
                  <input
                    type="number"
                    className={`${inputCls} font-mono`}
                    value={form.display_order}
                    onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                  />
                </div>
                {editingCode && (
                  <label className="sm:col-span-2 flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none pt-5">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    Đang sử dụng (tắt để ẩn khu và các phòng của khu khỏi sơ đồ giám sát)
                  </label>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 min-h-[40px] rounded-xl border border-slate-300 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-60"
                >
                  <Check className="w-4 h-4" /> {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          )}

          {loadError && (
            <div role="alert" className="rounded-xl border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 px-4 py-3 text-sm">
              {loadError}
            </div>
          )}

          {!loadError && (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-[11px] uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="text-left font-bold px-3 py-2.5">Mã</th>
                    <th className="text-left font-bold px-3 py-2.5">Tên khu</th>
                    <th className="text-right font-bold px-3 py-2.5">Phòng</th>
                    <th className="text-left font-bold px-3 py-2.5">Trạng thái</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {loading && items.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Đang tải...</td></tr>
                  )}
                  {!loading && items.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Chưa có khu nào. Bấm "Thêm khu" để tạo.</td></tr>
                  )}
                  {items.map((b) => (
                    <tr key={b.building_code} className={b.active ? '' : 'opacity-60'}>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-white">{b.building_code}</td>
                      <td className="px-3 py-2.5 text-slate-800 dark:text-slate-200">{b.building_name}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">{b.room_count}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                          b.active
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                            : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600'
                        }`}>
                          {b.active ? 'Đang dùng' : 'Đã tắt'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {!canManage ? null : confirmDelete === b.building_code ? (
                            <>
                              <span className="text-xs text-slate-600 dark:text-slate-300">Xóa khu này?</span>
                              <button
                                type="button"
                                onClick={() => remove(b.building_code)}
                                className="px-2.5 min-h-[36px] rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
                              >
                                Xóa
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(null)}
                                className="px-2.5 min-h-[36px] rounded-lg border border-slate-300 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                              >
                                Hủy
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(b)}
                                aria-label={`Sửa khu ${b.building_code}`}
                                title="Sửa"
                                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(b.building_code)}
                                aria-label={`Xóa khu ${b.building_code}`}
                                title={b.room_count > 0 ? 'Khu còn phòng, chưa xóa được' : 'Xóa'}
                                className="w-9 h-9 rounded-lg flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Khu còn phòng học thì không xóa được; hãy chuyển các phòng sang khu khác (ở màn hình sửa phòng) hoặc tắt khu.
        </p>
      </div>
    </section>
  );
};

export default BuildingManagerPanel;
