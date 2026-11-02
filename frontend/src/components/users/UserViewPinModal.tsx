import React, { useState } from 'react';
import { KeyRound, Copy, CheckCircle2, ShieldAlert } from 'lucide-react';
import { http } from '../../services/http';
import { toast } from '../common/Toast';

export const UserViewPinModal = ({ open, onClose }: { open: boolean, onClose: () => void }) => {
  const [pin, setPin] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGetPin = async () => {
    setLoading(true);
    try {
      const res: any = await http('/api/user/my-pin');
      setPin(res.pin);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lấy mã PIN');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl border border-amber-500/30">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-8 h-8" />
        </div>
        
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Mã PIN Bảo Mật Mới</h3>
        
        {!pin ? (
          <>
            <p className="text-sm text-slate-500 mb-6">
              Quản trị viên vừa cấp mã PIN mới cho bạn.<br/>
              <strong className="text-rose-500">Cảnh báo: Mã PIN chỉ hiển thị 1 lần duy nhất!</strong>
            </p>
            <button 
              onClick={handleGetPin}
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition"
            >
              {loading ? 'Đang lấy mã...' : 'Xem mã PIN ngay'}
            </button>
          </>
        ) : (
          <>
            <div className="text-4xl font-mono tracking-[0.3em] font-bold text-emerald-600 dark:text-emerald-400 py-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl mb-4 border border-emerald-200">
              {pin}
            </div>
            
            <button onClick={handleCopy} className="w-full mb-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex justify-center items-center gap-2">
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Đã Copy' : 'Copy Mã PIN'}
            </button>

            <div className="flex items-start gap-2 text-left text-xs text-rose-600 bg-rose-50 p-3 rounded-lg mb-4">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>Nếu đóng bảng này, bạn sẽ <strong>KHÔNG THỂ</strong> xem lại mã PIN. Hãy ghi nhớ hoặc lưu ngay.</span>
            </div>

            <button 
              onClick={() => { setPin(null); onClose(); }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition"
            >
              Đã ghi nhớ - Đóng
            </button>
          </>
        )}
      </div>
    </div>
  );
};