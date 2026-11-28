import React, { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { getAuthHeaders } from '../../services/http';

export interface LibraryCoverProps {
  /** null = tài liệu chưa có ảnh bìa */
  url?: string | null;
  /** true: ảnh cần đăng nhập mới xem được (thùng rác, bản chờ duyệt) → tải kèm phiên đăng nhập */
  authenticated?: boolean;
  alt: string;
  className?: string;
}

/** Ảnh bìa tài liệu thư viện; không có hoặc tải lỗi thì hiện khung sách trống */
export const LibraryCover: React.FC<LibraryCoverProps> = ({ url, authenticated = false, alt, className = 'w-10 h-14' }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setBlobUrl(null);
    if (!url || !authenticated) return undefined;
    let cancelled = false;
    let created: string | null = null;
    fetch(url, { headers: getAuthHeaders() })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => {
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setBlobUrl(created);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url, authenticated]);

  const src = authenticated ? blobUrl : url;
  const frame = `${className} shrink-0 rounded-md border border-slate-200 dark:border-white/10 overflow-hidden`;

  if (!src || failed) {
    return (
      <span role="img" aria-label={`${alt} (chưa có ảnh bìa)`} className={`${frame} flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400`}>
        <BookOpen className="w-1/2 h-1/2 max-w-6 max-h-6" />
      </span>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`${frame} object-cover bg-white`} />;
};

export default LibraryCover;
