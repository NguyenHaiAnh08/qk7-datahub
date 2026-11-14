// frontend/src/pages/LectureCatalogsPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, BookOpen, GraduationCap, Building2, RotateCw } from 'lucide-react';
import { lectureService } from '../services/lectureService';
import { toast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

type CatalogType = 'subjects' | 'classes' | 'classrooms';

interface Props { catalogType: CatalogType; }

const META: Record<CatalogType, {
  title: string; icon: any; pkField: string; nameField: string;
  service: {
    list: () => Promise<any>;
    create: (d: any) => Promise<any>;
    update: (id: string, d: any) => Promise<any>;
    remove: (id: string) => Promise<any>;
  };
  columns: Array<{ key: string; label: string; render?: (row: any) => any }>;
}> = {
  subjects: {
    title: 'Quản Lý Môn Học',
    icon: BookOpen,
    pkField: 'subject_id',
    nameField: 'name',
    service: {
      list: lectureService.adminListSubjects.bind(lectureService),
      create: lectureService.adminCreateSubject.bind(lectureService),
      update: lectureService.adminUpdateSubject.bind(lectureService),
      remove: lectureService.adminDeleteSubject.bind(lectureService),
    },
    columns: [
      { key: 'subject_id',   label: 'Mã môn' },
      { key: 'subject_code', label: 'Mã số' },
      { key: 'name',         label: 'Tên môn học' },
      { key: 'faculty_name', label: 'Khoa/Bộ môn' },
      { key: 'security_level_id', label: 'Cấp độ', render: (r) => `Cấp ${r.security_level_id}` },
      { key: 'active', label: 'Trạng thái', render: (r) => r.active ? 'Đang dùng' : 'Đã ẩn' },
    ],
  },
  classes: {
    title: 'Quản Lý Lớp Học',
    icon: GraduationCap,
    pkField: 'class_id',
    nameField: 'class_name',
    service: {
      list: lectureService.adminListClasses.bind(lectureService),
      create: lectureService.adminCreateClass.bind(lectureService),
      update: lectureService.adminUpdateClass.bind(lectureService),
      remove: lectureService.adminDeleteClass.bind(lectureService),
    },
    columns: [
      { key: 'class_id',      label: 'Mã lớp' },
      { key: 'class_name',    label: 'Tên lớp học' },
      { key: 'unit_name',     label: 'Đơn vị' },
      { key: 'course_year',   label: 'Khóa' },
      { key: 'student_total', label: 'Sĩ số cố định', render: (r) => r.student_total ?? '—' },
      { key: 'active',        label: 'Trạng thái', render: (r) => r.active ? 'Đang dùng' : 'Đã ẩn' },
    ],
  },
  classrooms: {
    title: 'Quản Lý Giảng Đường',
    icon: Building2,
    pkField: 'room_id',
    nameField: 'room_name',
    service: {
      list: lectureService.adminListClassrooms.bind(lectureService),
      create: lectureService.adminCreateClassroom.bind(lectureService),
      update: lectureService.adminUpdateClassroom.bind(lectureService),
      remove: lectureService.adminDeleteClassroom.bind(lectureService),
    },
    columns: [
      { key: 'room_id',       label: 'Mã phòng' },
      { key: 'room_name',     label: 'Tên giảng đường' },
      { key: 'building_name', label: 'Tòa nhà' },
      { key: 'room_type',     label: 'Loại phòng' },
      { key: 'capacity',      label: 'Sức chứa', render: (r) => r.capacity ?? '—' },
      { key: 'active',        label: 'Trạng thái', render: (r) => r.active ? 'Đang dùng' : 'Đã ẩn' },
    ],
  },
};

export const LectureCatalogsPage: React.FC<Props> = ({ catalogType }) => {
  const cfg = META[catalogType];
  const Icon = cfg.icon;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await cfg.service.list();
      setItems(res.items || []);
    } catch (e: any) {
      toast.error('Lỗi tải dữ liệu: ' + e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [catalogType]);

  const openCreate = () => {
    setEditing(null);
    setForm({ active: true, security_level_id: 2, course_year: new Date().getFullYear() });
    setModalOpen(true);
  };
  const openEdit = (row: any) => {
    setEditing(row);
    setForm({ ...row });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) await cfg.service.update(editing[cfg.pkField], form);
      else await cfg.service.create(form);
      toast.success(editing ? 'Đã cập nhật' : 'Đã tạo mới');
      setModalOpen(false);
      await load();
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      const res: any = await cfg.service.remove(deleteItem[cfg.pkField]);
      toast.success(res?.soft_deleted ? (res.note || 'Đã ẩn khỏi danh mục') : 'Đã xóa');
      setDeleteItem(null);
      await load();
    } catch (e: any) {
      toast.error('Lỗi xóa: ' + e.message);
      setDeleteItem(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            {cfg.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Tổng số: {items.length} bản ghi
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold flex items-center gap-1.5">
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới
          </button>
          <button onClick={openCreate} className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Thêm mới
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase font-bold text-slate-500 border-b">
            <tr>
              {cfg.columns.map(c => <th key={c.key} className="py-3 px-4">{c.label}</th>)}
              <th className="py-3 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={cfg.columns.length + 1} className="py-12 text-center text-slate-400">Đang tải...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={cfg.columns.length + 1} className="py-12 text-center text-slate-400">Chưa có dữ liệu</td></tr>
            ) : items.map(row => (
              <tr key={row[cfg.pkField]} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                {cfg.columns.map(c => (
                  <td key={c.key} className="py-3 px-4">
                    {c.render ? c.render(row) : (row[c.key] ?? '—')}
                  </td>
                ))}
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(row)} className="p-1.5 mr-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setDeleteItem(row)} className="p-1.5 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 space-y-3 shadow-2xl">
            <h3 className="font-bold text-base">{editing ? 'Chỉnh sửa' : 'Thêm mới'} — {cfg.title}</h3>

            {catalogType === 'subjects' && (
              <>
                <Field label="Mã môn *"><input value={form.subject_id || ''} onChange={e => setForm({...form, subject_id: e.target.value})} disabled={!!editing} required /></Field>
                <Field label="Mã số"><input value={form.subject_code || ''} onChange={e => setForm({...form, subject_code: e.target.value})} /></Field>
                <Field label="Tên môn học *"><input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} required /></Field>
                <Field label="Đơn vị (Khoa)"><input value={form.faculty_unit_id || ''} onChange={e => setForm({...form, faculty_unit_id: e.target.value})} placeholder="VD: TQS, K-GV" /></Field>
                <Field label="Cấp bảo mật"><input type="number" min={1} max={5} value={form.security_level_id || 2} onChange={e => setForm({...form, security_level_id: Number(e.target.value)})} /></Field>
                <Field label="Mô tả"><textarea rows={2} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></Field>
              </>
            )}

            {catalogType === 'classes' && (
              <>
                <Field label="Mã lớp *"><input value={form.class_id || ''} onChange={e => setForm({...form, class_id: e.target.value})} disabled={!!editing} required /></Field>
                <Field label="Tên lớp học *"><input value={form.class_name || ''} onChange={e => setForm({...form, class_name: e.target.value})} required placeholder="VD: Trung đội 10 - Đại đội 1" /></Field>
                <Field label="Đơn vị"><input value={form.unit_id || ''} onChange={e => setForm({...form, unit_id: e.target.value})} placeholder="VD: TQS" /></Field>
                <Field label="Khóa"><input type="number" value={form.course_year || ''} onChange={e => setForm({...form, course_year: Number(e.target.value) || null})} /></Field>
                <Field label="Sĩ số cố định (học viên) *">
                  <input type="number" min={0} required value={form.student_total ?? ''} onChange={e => setForm({...form, student_total: e.target.value === '' ? null : Number(e.target.value)})} />
                  <p className="text-[10px] text-slate-400 mt-1">Giá trị này sẽ được tự động điền khi mở ca giảng dạy</p>
                </Field>
                <Field label="Mô tả"><textarea rows={2} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></Field>
              </>
            )}

            {catalogType === 'classrooms' && (
              <>
                <Field label="Mã phòng *"><input value={form.room_id || ''} onChange={e => setForm({...form, room_id: e.target.value})} disabled={!!editing} required /></Field>
                <Field label="Tên giảng đường *"><input value={form.room_name || ''} onChange={e => setForm({...form, room_name: e.target.value})} required /></Field>
                <Field label="Tòa nhà"><input value={form.building_name || ''} onChange={e => setForm({...form, building_name: e.target.value})} /></Field>
                <Field label="Loại phòng">
                  <select value={form.room_type || 'LECTURE_HALL'} onChange={e => setForm({...form, room_type: e.target.value})}>
                    <option value="LECTURE_HALL">Giảng đường</option>
                    <option value="COMPUTER_LAB">Phòng máy</option>
                    <option value="SEMINAR">Phòng hội thảo</option>
                  </select>
                </Field>
                <Field label="Sức chứa"><input type="number" min={0} value={form.capacity ?? ''} onChange={e => setForm({...form, capacity: e.target.value === '' ? null : Number(e.target.value)})} /></Field>
                <Field label="Mô tả"><textarea rows={2} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></Field>
              </>
            )}

            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" checked={form.active !== false} onChange={e => setForm({...form, active: e.target.checked})} />
              <span className="text-xs">Đang kích hoạt (hiển thị trong dropdown)</span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">Hủy</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50">
                {submitting ? 'Đang lưu...' : 'Lưu lại'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteItem}
        title={`Xóa ${cfg.title}`}
        message={`Xác nhận xóa "${deleteItem?.[cfg.nameField]}" (${deleteItem?.[cfg.pkField]})?`}
        confirmText="Xác nhận xóa"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
      />
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">{label}</label>
    <div className="[&_input]:w-full [&_input]:px-3 [&_input]:py-2 [&_input]:bg-slate-50 [&_input]:dark:bg-slate-950 [&_input]:border [&_input]:border-slate-300 [&_input]:dark:border-slate-700 [&_input]:rounded-xl [&_input]:text-sm [&_select]:w-full [&_select]:px-3 [&_select]:py-2 [&_select]:bg-slate-50 [&_select]:dark:bg-slate-950 [&_select]:border [&_select]:border-slate-300 [&_select]:dark:border-slate-700 [&_select]:rounded-xl [&_select]:text-sm [&_textarea]:w-full [&_textarea]:px-3 [&_textarea]:py-2 [&_textarea]:bg-slate-50 [&_textarea]:dark:bg-slate-950 [&_textarea]:border [&_textarea]:border-slate-300 [&_textarea]:dark:border-slate-700 [&_textarea]:rounded-xl [&_textarea]:text-sm">
      {children}
    </div>
  </div>
);

export default LectureCatalogsPage;