import React, { useState } from 'react';
import { Button, Input, InputNumber, Modal, Popconfirm, Switch, Tooltip } from 'antd';
import { Pencil, Trash2 } from 'lucide-react';
import { libraryService } from '../../services/libraryService';
import { isApprovalRequired } from '../../utils/approvalUtils';
import { toast } from '../common/Toast';
import type { LibraryCategory } from '../../types/library';

const EMPTY = { name: '', description: '', sort_order: 100, active: true };

export interface LibraryCategoryModalProps {
  open: boolean;
  categories: LibraryCategory[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}

export const LibraryCategoryModal: React.FC<LibraryCategoryModalProps> = ({ open, categories, onClose, onChanged }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setEditingId(null);
    setDraft(EMPTY);
  };

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      const res = await action();
      if (!isApprovalRequired(res)) toast.success(done);
      reset();
      await onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Không thực hiện được');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!draft.name.trim()) {
      toast.warning('Nhập tên thể loại');
      return;
    }
    run(
      () => (editingId ? libraryService.updateCategory(editingId, draft) : libraryService.createCategory(draft)),
      editingId ? 'Đã lưu thể loại' : 'Đã thêm thể loại',
    );
  };

  return (
    <Modal
      open={open}
      title="Danh mục thể loại thư viện"
      width={680}
      centered
      footer={null}
      onCancel={() => { reset(); onClose(); }}
      destroyOnHidden
    >
      <div className="rounded-lg border border-slate-200 dark:border-white/[0.08] p-3 space-y-2 bg-slate-50 dark:bg-white/[0.02]">
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {editingId ? 'Sửa thể loại' : 'Thêm thể loại'}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
          <Input placeholder="Tên thể loại" maxLength={150} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Tooltip title="Số nhỏ đứng trước">
            <InputNumber className="!w-full" min={0} max={100000} precision={0} value={draft.sort_order} onChange={(v) => setDraft({ ...draft, sort_order: v ?? 100 })} aria-label="Thứ tự hiển thị" />
          </Tooltip>
        </div>
        <Input placeholder="Mô tả (không bắt buộc)" maxLength={500} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <Switch size="small" checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} />
            Đang sử dụng
          </label>
          <div className="flex gap-2">
            {editingId && <Button onClick={reset} disabled={busy}>Hủy sửa</Button>}
            <Button type="primary" onClick={save} loading={busy}>{editingId ? 'Lưu thể loại' : 'Thêm thể loại'}</Button>
          </div>
        </div>
      </div>

      <ul className="mt-3 max-h-[42vh] overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06]">
        {categories.map((c) => (
          <li key={c.category_id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {c.name}
                {!c.active && <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-300">Ngừng sử dụng</span>}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{c.description || '—'}</div>
            </div>
            <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">{c.item_count} tài liệu</span>
            <Button
              aria-label={`Sửa thể loại ${c.name}`}
              icon={<Pencil className="w-3.5 h-3.5" />}
              onClick={() => {
                setEditingId(c.category_id);
                setDraft({ name: c.name, description: c.description || '', sort_order: c.sort_order, active: c.active });
              }}
            />
            <Popconfirm
              title="Xóa thể loại này?"
              description="Chỉ xóa được thể loại chưa có tài liệu."
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => run(() => libraryService.deleteCategory(c.category_id), 'Đã xóa thể loại')}
            >
              <Button danger aria-label={`Xóa thể loại ${c.name}`} icon={<Trash2 className="w-3.5 h-3.5" />} />
            </Popconfirm>
          </li>
        ))}
      </ul>
    </Modal>
  );
};

export default LibraryCategoryModal;
