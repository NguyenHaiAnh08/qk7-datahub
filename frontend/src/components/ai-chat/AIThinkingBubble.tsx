import React, { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import './AIThinkingBubble.css';

export interface AIThinkingBubbleProps {
  /** Hiển thị nhãn giải mã khi đang lấy lại câu trả lời sau khi xác thực vân tay */
  isDecrypting?: boolean;
  /** Chế độ thu gọn cho widget nhỏ */
  compact?: boolean;
  /** Hiển thị dòng tên vai trò "Đồng chí Trợ lý AI" phía trên */
  showRoleLabel?: boolean;
}

const THINKING_PHASES = [
  'Đang suy nghĩ và truy vấn kho văn bản số…',
  'Đang tổng hợp căn cứ trích dẫn…',
  'Đang hoàn thiện câu trả lời…',
];

export const AIThinkingBubble: React.FC<AIThinkingBubbleProps> = ({
  isDecrypting = false,
  compact = false,
  showRoleLabel = true,
}) => {
  const [phaseIdx, setPhaseIdx] = useState(0);

  useEffect(() => {
    setPhaseIdx(0);
    if (isDecrypting) return;
    const t1 = setTimeout(() => setPhaseIdx(1), 3500);
    const t2 = setTimeout(() => setPhaseIdx(2), 7500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isDecrypting]);

  const statusText = isDecrypting
    ? 'Đang giải mã và lập báo cáo câu trả lời…'
    : THINKING_PHASES[phaseIdx];

  return (
    <div
      className={`qk7-ai-think${compact ? ' is-compact' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={statusText}
    >
      {showRoleLabel && (
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-900 dark:text-emerald-400 tracking-wide px-1">
          <Bot className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Đồng chí Trợ lý AI</span>
        </div>
      )}

      <div className="qk7-ai-think-row">
        <div className="qk7-ai-avatar" aria-hidden="true">
          <Bot className={compact ? 'w-4 h-4 stroke-[2.2]' : 'w-5 h-5 stroke-[2.2]'} />
        </div>

        <div className="qk7-ai-bubble" aria-hidden="true">
          <span className="qk7-ai-dot" />
          <span className="qk7-ai-dot" />
          <span className="qk7-ai-dot" />
        </div>
      </div>

      <span className="qk7-ai-caption">{statusText}</span>
    </div>
  );
};

export default AIThinkingBubble;
