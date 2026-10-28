import React, { useEffect, useState } from 'react';
import { Lock, Unlock, ShieldCheck } from 'lucide-react';
import { approvalService } from '../services/approvalService';
import { permissionService } from '../services/permissionService';
import { toast } from '../components/common/Toast';

export const ProtectedPermissionsConfigPage: React.FC = () => {
  const [perms, setPerms] = useState<any[]>([]);
  const [protectedIds, setProtectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [p, prot] = await Promise.all([
        permissionService.getPermissions(),
        approvalService.listProtected(),
      ]);
      setPerms(p.items || []);
      setProtectedIds(new Set((prot.items || []).map(x => x.permission_id)));
    } catch (err: any) {
      toast.error('Lỗi tải: ' + err.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (permId: string) => {
    const isProtected = protectedIds.has(permId);
    try {
      if (isProtected) {
        await approvalService.unprotect(permId);
        toast.info(`Đã tắt bảo vệ ${permId}`);
      } else {
        await approvalService.protect(permId);
        toast.success(`Đã bật bảo vệ ${permId}`);
      }
      await load();
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    }
  };

  const grouped = perms.reduce((acc, p) => {
    (acc[p.group_code || 'SYSTEM'] ||= []).push(p);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-amber-500" />
          Cấu Hình Khóa Bảo Vệ
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Bật khóa → mọi user không phải Admin tối cao khi thực hiện hành động này sẽ phải chờ Admin phê duyệt.
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500">Đang tải...</div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([groupCode, list]: [string, any[]]) => (
            <div key={groupCode} className="bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300 font-mono">{groupCode}</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {list.map((p) => {
                  const isProtected = protectedIds.has(p.permission_id);
                  return (
                    <div key={p.permission_id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">{p.code || p.permission_id}</span>
                          {isProtected && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold">
                              ĐANG KHÓA
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{p.description || '—'}</div>
                      </div>
                      <button
                        onClick={() => toggle(p.permission_id)}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition ${
                          isProtected
                            ? 'bg-rose-600 hover:bg-rose-500 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {isProtected ? <><Lock className="w-3 h-3" /> Đang khóa</> : <><Unlock className="w-3 h-3" /> Bật khóa</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};