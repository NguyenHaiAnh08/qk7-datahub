/* <!-- AI Chat Drawer Component --> */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Spin,
  Tooltip,
} from 'antd';
import {
  Bot,
  X,
  Send,
  RotateCcw,
  Sparkles,
  FileText,
  Shield,
  ExternalLink,

} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAIChat } from '../../contexts/AIChatContext';
import { aiService, AICitation } from '../../services/aiService';
import { fileService } from '../../services/fileService';
import { toast } from '../common/Toast';
import { FingerprintScanModal } from '../users/FingerprintScanModal';
import { DocumentPreviewModal } from '../document-desk/DocumentPreviewModal';
import { DocumentItem } from '../../types';
import { Fingerprint } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  citations?: AICitation[];
  requires_biometric?: boolean;
  reasoning?: {
    mem?: string;
    think?: string;
    tool_call?: string;
  };
}

export const AIChatDrawer: React.FC = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { isChatOpen, setIsChatOpen, aiStatus, setAiStatus } = useAIChat();

  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // State lưu token vân tay đã xác thực trong phiên làm việc
  const [fpToken, setFpToken] = useState<string | null>(null);
  // Lưu câu hỏi gần nhất của user để auto-retry sau khi quét vân tay
  const [lastQuery, setLastQuery] = useState<string>('');
  const lastUserQueryRef = useRef<string>('');

  // State cho Khóa Bảo Vệ Sinh Trắc Học Vân Tay ZK9500 & Modal Xem trước PDF an toàn
  const [scanModalOpen, setScanModalOpen] = useState<boolean>(false);
  const [targetScanFileId, setTargetScanFileId] = useState<string>('');
  const [targetScanDocCode, setTargetScanDocCode] = useState<string>('');
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isChatOpen) {
      scrollToBottom();
      // Focus vào ô nhập liệu khi mở
      setTimeout(() => inputRef.current?.focus(), 150);
      checkServiceStatus();
    }
  }, [isChatOpen, messages]);

  // Đóng Drawer bằng phím ESC
  useEffect(() => {
    if (!isChatOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsChatOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatOpen, setIsChatOpen]);

  const checkServiceStatus = async () => {
    try {
      const res = await aiService.checkHealth();
      if (res.status === 'online') {
        setAiStatus('online');
      } else {
        setAiStatus('fallback');
      }
    } catch {
      setAiStatus('fallback');
    }
  };

  // ✅ SỬA: Thêm tham số fileIdOverride để truyền file_id lên Backend kiểm tra chéo token
  const handleSend = async (
    customPrompt?: string,
    tokenOverride?: string,
    isRetry: boolean = false,
    fileIdOverride?: string
  ) => {
    const textToSend = (customPrompt || inputText).trim();
    if (!textToSend || (loading && !isRetry)) return;

    setLastQuery(textToSend);
    lastUserQueryRef.current = textToSend;

    if (!isRetry) {
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'user',
        text: textToSend,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMsg]);
      if (!customPrompt) setInputText('');
    }

    setLoading(true);

    const history = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-6)
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

    // P0 SECURITY: Câu hỏi mới (isRetry = false) TUYỆT ĐỐI KHÔNG tự động gửi kèm token cũ.
    // Chỉ khi là retry sau khi quét vân tay (isRetry = true) thì mới dùng tokenOverride.
    const activeToken = isRetry ? tokenOverride : undefined;

    try {
      const res = await aiService.chat({
        query: textToSend,
        history,
        fingerprint_token: activeToken,
        file_id: fileIdOverride, // ✅ Truyền file_id lên Backend
      });
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: res.answer || 'Xin lỗi, không có câu trả lời từ máy chủ.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        citations: res.citations || [],
        requires_biometric: res.requires_biometric,
        reasoning: res.reasoning,
      };

      if (isRetry) {
        setMessages((prev) => {
          const lastAiIdx = prev.map((m) => m.sender).lastIndexOf('ai');
          if (lastAiIdx !== -1) {
            const next = [...prev];
            next[lastAiIdx] = aiMsg;
            return next;
          }
          return [...prev, aiMsg];
        });
      } else {
        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: `⚠️ Đã có sự cố khi kết nối với Trợ lý AI: ${err.message || 'Lỗi không xác định'}.`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPdf = (
    fileId: string,
    page: number = 1,
    docCode?: string,
    title?: string,
    secName?: string,
    requiresBio: boolean = false
  ) => {
    // ✅ FIX: Nếu chuyển sang file khác, xóa sạch token cũ trong state
    if (fileId !== previewDoc?.file_id) {
      setFpToken(null);
    }

    let secLevel = 1;
    if (requiresBio) {
      secLevel = 3;
    } else if (secName) {
      const lower = secName.toLowerCase();
      if (lower.includes('5') || lower.includes('tuyệt mật')) secLevel = 5;
      else if (lower.includes('4') || lower.includes('tối mật')) secLevel = 4;
      else if (lower.includes('3') || lower.includes('mật')) secLevel = 3;
      else if (lower.includes('2') || lower.includes('nội bộ')) secLevel = 2;
    }

    const docItem: DocumentItem = {
      file_id: fileId,
      document_code: docCode || fileId,
      title: title || docCode || 'Văn kiện trích dẫn',
      security_level_id: secLevel,
      security_name: secName || `Cấp ${secLevel}`,
      security_level_name: secName || `Cấp ${secLevel}`,
    };

    setPreviewDoc(docItem);
    setPreviewPage(page);
    setPreviewOpen(true);
  };

  const handleFingerprintSuccess = async (token: string) => {
    setScanModalOpen(false);
    const validToken = token || '';
    if (validToken && typeof window !== 'undefined') {
      if (targetScanFileId) {
      sessionStorage.setItem(`qk7_fp_token_${targetScanFileId}`, validToken);
    }
      setFpToken(validToken);
    }

    toast.success(
      `Xác thực vân tay ZK9500 thành công! Đang lấy câu trả lời...`,
      { title: 'SINH TRẮC HỌC HỢP LỆ', duration: 3000 }
    );

    const queryToRetry = lastQuery || lastUserQueryRef.current || inputText.trim();
    if (queryToRetry) {
      setLoading(true);
      // ✅ SỬA: Truyền targetScanFileId vào để Backend kiểm tra chéo token-file
      await handleSend(queryToRetry, validToken, true, targetScanFileId);
    } else if (targetScanFileId) {
      handleOpenPdf(targetScanFileId, 1, targetScanDocCode, undefined, 'Cấp 3 - Mật');
    }
  };

  return (
    <>
      <AnimatePresence>
        {isChatOpen && (
          <div key="ai-chat-drawer-container" className="fixed inset-0 z-50 overflow-hidden select-none">
            {/* 1. LỚP PHỦ MỜ BACKDROP (backdrop-blur-md bg-black/50 z-50) */}
            <motion.div
              key="ai-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setIsChatOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-md cursor-pointer"
              aria-label="Đóng khung chat trợ lý AI"
            />

            {/* 2. KHUNG CHAT TRƯỢT PHẢI (SLIDE-OVER DRAWER) */}
            <motion.div
              key="ai-drawer-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{
                type: 'spring',
                damping: 30,
                stiffness: 300,
                mass: 0.85,
              }}
              className="fixed top-0 right-0 bottom-0 w-full sm:w-[380px] md:w-[420px] max-w-full flex flex-col bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-xl border-l border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-50"
            >
              {/* HEADER KHUNG CHAT */}
              <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#14532d] via-[#166534] to-[#15803d] border border-amber-400/40 flex items-center justify-center text-white shadow-xs shrink-0">
                    <Bot className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                        Trợ lý AI - Dữ liệu Số QK7
                      </h3>
                      <span
                        className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                          aiStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        title={aiStatus === 'online' ? 'DeepTutor Vector DB Sẵn Sàng' : 'Smart SQL Fallback'}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center space-x-1">
                      <span>Trường Quân Sự QK7</span>
                      <span>•</span>
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        {user?.clearance_name || `Cấp ${user?.clearance_level_id || 1}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <Tooltip title="Làm mới hội thoại" placement="bottom">
                    <button
                      type="button"
                      onClick={() => {
                        setMessages([]);
                        toast.success('Đã làm mới phiên hội thoại với Trợ lý AI.', {
                          title: 'PHIÊN MỚI',
                          badge: 'AI-RESET',
                        });
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                      aria-label="Làm mới hội thoại"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>

                  <button
                    type="button"
                    onClick={() => setIsChatOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                    aria-label="Đóng khung chat (ESC)"
                    title="Đóng (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* DANH SÁCH TIN NHẮN (BONG BÓNG CHAT) */}
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 scrollbar-thin select-text">
                {/* Lời chào & gợi ý câu hỏi khi chưa có tin nhắn */}
                {messages.length === 0 && (
                  <div className="py-6 px-3 text-center space-y-4">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs">
                      <Sparkles className="w-6 h-6 stroke-[2]" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        Sẵn sàng hỗ trợ tác chiến & tra cứu
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                        Đồng chí có thể đặt câu hỏi về quy định, kế hoạch huấn luyện hoặc văn bản được phân quyền.
                      </p>
                    </div>
                  </div>
                )}

                {/* Danh sách tin nhắn đã gửi */}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] text-white rounded-tr-xs border border-emerald-600/30'
                          : isDark
                          ? 'bg-[#111827] text-slate-100 border border-emerald-800/40 rounded-tl-xs'
                          : 'bg-[#f0fdf4] text-slate-900 border border-[#86efac] rounded-tl-xs'
                      }`}
                    >
                      {/* Nội dung tin nhắn */}
                      <div className="whitespace-pre-wrap font-sans">
                        {renderFormattedText(msg.text)}
                      </div>

                      {/* NÚT QUÉT VÂN TAY NẾU CÓ CỜ requires_biometric (chỉ hiện khi chưa có token) */}
                      {msg.requires_biometric && (
                        <div className="mt-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              const targetCitation = msg.citations?.find((c) => c.requires_biometric);
                              const fid = targetCitation?.file_id || targetScanFileId || '';
                              const code = targetCitation?.document_code || 'Văn bản bảo mật';
                              setTargetScanFileId(fid);
                              setTargetScanDocCode(code);
                              setScanModalOpen(true);
                            }}
                            className="w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all duration-200 bg-gradient-to-r from-[#991b1b] via-[#b91c1c] to-[#d97706] hover:from-[#b91c1c] hover:to-[#f59e0b] text-white shadow-md active:scale-[0.98] border border-amber-400/40 cursor-pointer"
                          >
                            <Fingerprint className="w-4 h-4 text-amber-300 animate-pulse flex-shrink-0" />
                            <span>Quét vân tay để nhận câu trả lời</span>
                          </button>
                        </div>
                      )}

                      {/* Căn cứ trích dẫn văn bản & Thao tác */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-emerald-500/20 dark:border-emerald-700/30 space-y-1.5">
                          <div className="text-[10px] font-bold tracking-wider uppercase text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            <span>Căn cứ văn bản trích dẫn:</span>
                          </div>

                          {msg.citations.map((c, cIdx) => (
                            <div key={cIdx} className="space-y-1">
                              <button
                                type="button"
                                onClick={() => handleOpenPdf(c.file_id, c.page, c.document_code, c.title, c.security_level_name, Boolean(c.requires_biometric))}
                                className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-between transition-all cursor-pointer ${
                                  isDark
                                    ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/50'
                                    : 'bg-white hover:bg-emerald-50/80 text-emerald-900 border border-emerald-200'
                                }`}
                                title="Bấm để mở văn bản tại trang trích dẫn"
                              >
                                <span className="truncate flex-1">
                                  📄 Trang {c.page || 1} • {c.title || c.document_code || c.file_id}
                                </span>
                                <ExternalLink className="w-3 h-3 ml-1 text-slate-400 shrink-0" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 px-1">
                      {msg.timestamp}
                    </span>
                  </div>
                ))}


                {/* Trạng thái đang tải câu trả lời */}
                {loading && (
                  <div className="flex items-center space-x-2 text-xs text-emerald-600 dark:text-emerald-400 pl-2 p-2 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-500/20 animate-pulse">
                    <Spin size="small" />
                    <span className="font-medium">
                      {lastQuery ? 'Đang lấy câu trả lời...' : 'Trợ lý AI đang tra cứu kho dữ liệu số...'}
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* THANH NHẬP LIỆU GHIM CỐ ĐỊNH Ở ĐÁY */}
              <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/90 shrink-0">
                <div
                  className={`flex items-center rounded-2xl px-3 py-1.5 border transition-all duration-200 ${
                    isDark
                      ? 'bg-[#111827] border-slate-700 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-600/25'
                      : 'bg-slate-50 border-slate-300 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/20'
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSend();
                    }}
                    placeholder="Tra cứu văn thư hoặc hỏi đáp tác chiến..."
                    className="flex-1 bg-transparent text-xs focus:outline-none px-1 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                    disabled={loading}
                  />

                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={loading || !inputText.trim()}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-white transition-all cursor-pointer ${
                      inputText.trim() && !loading
                        ? 'bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:scale-105 active:scale-95 shadow-xs border border-amber-400/40'
                        : 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed text-slate-400'
                    }`}
                    title="Gửi câu hỏi (Enter)"
                    aria-label="Gửi câu hỏi"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-1.5">
                  Nhấn Enter để gửi • Esc để đóng
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <FingerprintScanModal
        open={scanModalOpen}
        fileId={targetScanFileId}
        onSuccess={handleFingerprintSuccess}
        onCancel={() => setScanModalOpen(false)}
      />

      <DocumentPreviewModal
        open={previewOpen}
        document={previewDoc}
        page={previewPage}
        initialToken={fpToken}
        onClose={() => {
          setPreviewOpen(false);
          setFpToken(null);
        }}
      />
    </>
  );
};

function renderFormattedText(text: string): React.ReactNode {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*|\[p\.\d+\])/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-emerald-800 dark:text-emerald-300">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (/^\[p\.\d+\]$/.test(part)) {
      return (
        <span
          key={index}
          className="inline-block px-1.5 py-0.5 mx-0.5 rounded text-amber-800 bg-amber-500/10 border border-amber-600/25 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/25 font-mono text-[11px]"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

export default AIChatDrawer;