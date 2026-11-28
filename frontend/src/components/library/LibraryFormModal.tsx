import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Form, Input, InputNumber, Modal, Select, TreeSelect, Upload } from 'antd';
import { FileUp, ImagePlus, Loader2, Sparkles } from 'lucide-react';
import { libraryService } from '../../services/libraryService';
import { buildUnitTree } from '../../utils/unitTree';
import { formatFileSize } from '../../utils/formatFileSize';
import { toast } from '../common/Toast';
import { LibraryCover } from './LibraryCover';
import type { Unit } from '../../types';
import type { LibraryCategory, LibraryItem, LibrarySaveResponse } from '../../types/library';

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface FormValues {
  title: string;
  category_id: string;
  document_code?: string;
  author?: string;
  publisher?: string;
  publish_year?: number | null;
  issuing_unit_id?: string;
  summary?: string;
  note?: string;
}

export interface LibraryFormModalProps {
  open: boolean;
  /** null = đăng tải mới */
  item: LibraryItem | null;
  categories: LibraryCategory[];
  units: Unit[];
  /** Người dùng được lưu thẳng (Admin / Chỉ huy) hay phải gửi đề xuất */
  direct: boolean;
  canParse: boolean;
  onClose: () => void;
  onSaved: (res: LibrarySaveResponse) => void;
}

export const LibraryFormModal: React.FC<LibraryFormModalProps> = ({
  open, item, categories, units, direct, canParse, onClose, onSaved,
}) => {
  const [form] = Form.useForm<FormValues>();
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<string | null>(null);
  // Lượt đọc tệp hiện hành: đổi tệp hoặc đóng/mở form thì bỏ kết quả đọc cũ (đọc bản scan có thể mất cả phút)
  const parseRun = useRef(0);
  const unitTree = useMemo(() => buildUnitTree(units), [units]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [useAutoCover, setUseAutoCover] = useState(false);

  // Xem trước ảnh vừa chọn
  useEffect(() => {
    if (!coverFile) { setCoverPreview(null); return undefined; }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);
  const isEdit = Boolean(item);

  useEffect(() => {
    parseRun.current += 1;
    setParsing(false);
    if (!open) return;
    setFile(null);
    setCoverFile(null);
    setUseAutoCover(false);
    setError(null);
    setDuplicate(null);
    form.resetFields();
    if (item) {
      form.setFieldsValue({
        title: item.title,
        category_id: item.category_id,
        document_code: item.document_code || '',
        author: item.author || '',
        publisher: item.publisher || '',
        publish_year: item.publish_year ?? null,
        issuing_unit_id: item.issuing_unit_id || undefined,
        summary: item.summary || '',
      });
    }
  }, [open, item, form]);

  const pickFile = (picked: File) => {
    setError(null);
    setDuplicate(null);
    if (!picked.name.toLowerCase().endsWith('.pdf')) {
      setError('Chỉ chấp nhận tệp PDF.');
    } else if (picked.size > MAX_PDF_BYTES) {
      setError(`Tệp ${formatFileSize(picked.size)} vượt giới hạn 50 MB.`);
    } else {
      parseRun.current += 1;
      setParsing(false);
      setFile(picked);
      if (!isEdit && !form.getFieldValue('title')) {
        form.setFieldValue('title', picked.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' '));
      }
    }
    return false; // không để antd tự tải lên
  };

  const pickCover = (picked: File) => {
    setError(null);
    if (!COVER_TYPES.includes(picked.type)) setError('Ảnh bìa phải là JPG, PNG hoặc WebP.');
    else if (picked.size > MAX_COVER_BYTES) setError(`Ảnh ${formatFileSize(picked.size)} vượt giới hạn 5 MB.`);
    else {
      setCoverFile(picked);
      setUseAutoCover(false);
    }
    return false;
  };

  // Gợi ý từ nội dung PDF; chỉ điền vào ô còn trống để không ghi đè điều người dùng đã nhập
  const autofill = async () => {
    if (!file) return;
    const run = ++parseRun.current;
    setParsing(true);
    setError(null);
    try {
      const res = await libraryService.parse(file);
      if (run !== parseRun.current) return;
      const p = res?.parsed;
      if (!p) throw new Error(res?.error || 'Không đọc được nội dung tệp.');
      const current = form.getFieldsValue();
      const next: Partial<FormValues> = {};
      const fromFileName = file.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ');
      if (p.title && (!current.title || current.title === fromFileName)) next.title = p.title;
      if (p.document_code && !current.document_code) next.document_code = p.document_code;
      if (p.signer && !current.author) next.author = p.signer;
      if (p.issued_date && !current.publish_year) {
        const year = Number(String(p.issued_date).match(/(19|20)\d{2}/)?.[0]);
        if (year) next.publish_year = year;
      }
      if (p.issuer_unit_id && !current.issuing_unit_id && units.some((u) => u.unit_id === p.issuer_unit_id)) {
        next.issuing_unit_id = p.issuer_unit_id;
      }
      form.setFieldsValue(next);
      const filled = Object.keys(next).length;
      if (filled) toast.info(`Đã điền gợi ý ${filled} ô. Đồng chí kiểm tra lại trước khi lưu.`);
      else toast.info('Không tìm thấy thông tin mới để điền.');
    } catch (err: any) {
      if (run !== parseRun.current) return;
      setError(`Không điền tự động được: ${err.message}. Đồng chí vẫn nhập tay và lưu bình thường.`);
    } finally {
      if (run === parseRun.current) setParsing(false);
    }
  };

  const submit = async (force = false) => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    if (!isEdit && !file) {
      setError('Chọn tệp PDF trước khi lưu.');
      return;
    }
    const data = new FormData();
    // Gửi cả giá trị rỗng để người dùng xóa được ô tùy chọn khi sửa
    (['title', 'category_id', 'document_code', 'author', 'publisher', 'publish_year', 'issuing_unit_id', 'summary'] as const)
      .forEach((key) => data.append(key, values[key] === undefined || values[key] === null ? '' : String(values[key])));
    if (values.note) data.append('note', values.note);
    if (force) data.append('force_upload', '1');
    if (file) data.append('file', file);
    if (coverFile) data.append('cover', coverFile);
    else if (useAutoCover) data.append('cover_auto', '1');

    setSaving(true);
    setError(null);
    setDuplicate(null);
    try {
      const res = item ? await libraryService.update(item.file_id, data) : await libraryService.create(data);
      onSaved(res);
    } catch (err: any) {
      if (err.data?.code === 'DUPLICATE_FILE') {
        const ex = err.data.existing;
        setDuplicate(ex ? `Tệp này đã có trong hệ thống: "${ex.title}".` : 'Tệp này đã có trong hệ thống.');
      } else {
        setError(err.message || 'Không lưu được tài liệu.');
      }
    } finally {
      setSaving(false);
    }
  };

  const title = !isEdit ? 'Đăng tải tài liệu thư viện' : direct ? 'Chỉnh sửa tài liệu thư viện' : 'Đề xuất chỉnh sửa tài liệu';
  const okText = direct ? (isEdit ? 'Lưu thay đổi' : 'Lưu vào thư viện') : 'Gửi chờ duyệt';

  return (
    <Modal
      open={open}
      title={title}
      width={760}
      centered
      okText={okText}
      cancelText="Hủy"
      confirmLoading={saving}
      onOk={() => submit(false)}
      onCancel={() => !saving && onClose()}
      maskClosable={false}
      destroyOnHidden
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 } }}
    >
      <Alert
        type="warning"
        showIcon
        className="mb-3"
        title="Thư viện mở cho mọi người, kể cả đại biểu tham quan. Không đăng tài liệu Mật, Tối mật, Tuyệt mật hoặc lưu hành nội bộ."
      />
      {!direct && (
        <Alert
          type="info"
          showIcon
          className="mb-3"
          title="Tài liệu chỉ thay đổi sau khi Chỉ huy hoặc Quản trị viên phê duyệt."
        />
      )}

      <Upload.Dragger accept=".pdf,application/pdf" multiple={false} showUploadList={false} beforeUpload={pickFile}>
        <div className="flex flex-col items-center gap-1 py-1">
          <FileUp className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
          {file ? (
            <>
              <span className="text-sm font-semibold break-all px-3">{file.name}</span>
              <span className="text-xs text-slate-500 tabular-nums">{formatFileSize(file.size)} · bấm để đổi tệp</span>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold">Chọn hoặc kéo tệp PDF vào đây</span>
              <span className="text-xs text-slate-500">
                {isEdit ? `Để trống nếu giữ tệp hiện tại (${item?.original_name || 'PDF'})` : 'Tối đa 50 MB'}
              </span>
            </>
          )}
        </div>
      </Upload.Dragger>

      {file && canParse && (
        <button
          type="button"
          onClick={autofill}
          disabled={parsing || saving}
          className="mt-2 min-h-[36px] px-3 rounded-lg text-xs font-semibold flex items-center gap-2 border border-emerald-600/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-50"
        >
          {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {parsing ? 'Đang đọc tệp… (vẫn lưu được)' : 'Điền gợi ý từ nội dung tệp'}
        </button>
      )}

      <div className="mt-3 flex items-start gap-3 rounded-lg border border-slate-200 dark:border-white/[0.08] p-3">
        <LibraryCover
          url={coverPreview || (item && !useAutoCover ? libraryService.coverUrl(item.file_id, item.cover_version) : null)}
          alt="Ảnh bìa"
          className="w-[72px] h-[102px]"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="text-sm font-semibold">Ảnh bìa</div>
          <div className="flex items-center gap-2 flex-wrap">
            <Upload accept=".jpg,.jpeg,.png,.webp" multiple={false} showUploadList={false} beforeUpload={pickCover} disabled={saving}>
              <Button icon={<ImagePlus className="w-4 h-4" />} disabled={saving}>{coverFile ? 'Chọn ảnh khác' : 'Chọn ảnh bìa'}</Button>
            </Upload>
            {coverFile && <Button type="link" onClick={() => setCoverFile(null)}>Bỏ ảnh đã chọn</Button>}
          </div>
          {item?.cover_custom && !coverFile && (
            <Checkbox checked={useAutoCover} onChange={(e) => setUseAutoCover(e.target.checked)}>
              Dùng lại bìa lấy từ trang 1
            </Checkbox>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {coverFile
              ? coverFile.name
              : 'Không chọn thì hệ thống tự lấy trang 1 của tệp PDF làm bìa. Ảnh JPG, PNG, WebP tối đa 5 MB.'}
          </p>
        </div>
      </div>

      {error && <Alert type="error" showIcon className="mt-3" title={error} />}
      {duplicate && (
        <Alert
          type="warning"
          showIcon
          className="mt-3"
          title={duplicate}
          action={(
            <button type="button" onClick={() => submit(true)} className="text-xs font-bold underline cursor-pointer min-h-[32px]">
              Vẫn đăng bản mới
            </button>
          )}
        />
      )}

      <Form form={form} layout="vertical" requiredMark className="mt-4" disabled={saving}>
        <Form.Item name="title" label="Tên tài liệu" rules={[{ required: true, whitespace: true, message: 'Nhập tên tài liệu' }]}>
          <Input maxLength={500} />
        </Form.Item>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Form.Item name="category_id" label="Thể loại" className="sm:col-span-2" rules={[{ required: true, message: 'Chọn thể loại' }]}>
            <Select
              placeholder="Chọn thể loại"
              options={categories
                .filter((c) => c.active || c.category_id === item?.category_id)
                .map((c) => ({ value: c.category_id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item name="author" label="Tác giả / Chủ biên">
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="publisher" label="Nhà xuất bản / Nơi biên soạn">
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="publish_year" label="Năm xuất bản">
            <InputNumber min={1900} max={new Date().getFullYear() + 1} precision={0} className="!w-full" />
          </Form.Item>
          <Form.Item
            name="document_code"
            label="Mã tài liệu"
            rules={[{ pattern: /^[A-Za-z0-9À-ỹ][A-Za-z0-9À-ỹ\-/._ ]{0,99}$/, message: 'Chỉ gồm chữ, số, gạch ngang, gạch chéo, dấu chấm' }]}
          >
            <Input maxLength={100} />
          </Form.Item>
        </div>
        <Form.Item name="issuing_unit_id" label="Đơn vị quản lý">
          <TreeSelect
            allowClear
            showSearch={{ treeNodeFilterProp: 'name' }}
            placeholder="Chọn đơn vị"
            treeData={unitTree as any}
            styles={{ popup: { root: { maxHeight: 360, overflow: 'auto' } } }}
          />
        </Form.Item>
        <Form.Item name="summary" label="Tóm tắt nội dung">
          <Input.TextArea rows={3} maxLength={4000} />
        </Form.Item>
        {!direct && (
          <Form.Item name="note" label="Ghi chú gửi người duyệt">
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default LibraryFormModal;
