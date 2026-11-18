/* <!-- AI Chat Drawer Component --> */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Spin, Tooltip } from 'antd';
import {
  Bot,
  X,
  Send,
  RotateCcw,
  Sparkles,
  FileText,
  Shield,
  ExternalLink,
  Fingerprint,
  Maximize2,
  Info,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Quote,
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

  // State lưu token vân tay đã xác thực trong phiên làm việc (kèm hạn 5 phút nội bộ Chatbox)
  const [fpToken, setFpToken] = useState<string | null>(null);
  const [fpTokenExpiresAt, setFpTokenExpiresAt] = useState<number | null>(null);
  // Lưu câu hỏi gần nhất của user để auto-retry sau khi quét vân tay
  const [lastQuery, setLastQuery] = useState<string>('');
  const lastUserQueryRef = useRef<string>('');

  // Lấy token vân tay còn hiệu lực nội bộ trong Chatbox (hạn 5 phút từ khi quét và đúng file)
  const getActiveFpToken = (forFileId?: string): string | null => {
    if (!fpToken || !fpTokenExpiresAt) return null;
    if (Date.now() >= fpTokenExpiresAt) {
      setFpToken(null);
      setFpTokenExpiresAt(null);
      return null;
    }
    if (forFileId && targetScanFileId && forFileId !== targetScanFileId) {
      return null;
    }
    return fpToken;
  };

  // Đóng khung chat và xóa sạch toàn bộ token bảo mật để không rò rỉ ra trang ngoài
  const handleCloseChat = () => {
    setIsChatOpen(false);
    setFpToken(null);
    setFpTokenExpiresAt(null);
    setTargetScanFileId('');
    setTargetScanDocCode('');
    setScanModalOpen(false);
    setPreviewOpen(false);
    if (typeof window !== 'undefined') {
      try {
        Object.keys(sessionStorage).forEach((key) => {
          if (key.startsWith('qk7_fp_token')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (_) {}
    }
  };

  // State cho Khóa Bảo Vệ Sinh Trắc Học Vân Tay ZK9500 & Modal Xem trước PDF an toàn
  const [scanModalOpen, setScanModalOpen] = useState<boolean>(false);
  const [targetScanFileId, setTargetScanFileId] = useState<string>('');
  const [targetScanDocCode, setTargetScanDocCode] = useState<string>('');
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  // 🔒 Khóa cuộn trang web cha khi mở Chatbox, bảo toàn vị trí cuộn & triệt tiêu cuộn xuyên tầng (Scroll Chaining)
  useEffect(() => {
    if (!isChatOpen || typeof window === 'undefined') return;

    // Ghi nhớ chính xác vị trí cuộn trang hiện tại
    const currentScrollY =
      window.scrollY ||
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyPaddingRight = document.body.style.paddingRight;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    // Tính độ rộng thanh cuộn để bù paddingRight, chống giật layout (layout shift)
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // Khóa cuộn tuyệt đối trang chính bên dưới
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.paddingRight = prevBodyPaddingRight;
      document.documentElement.style.overflow = prevHtmlOverflow;

      // Khôi phục vị trí cuộn mượt mà chính xác cho người dùng
      if (currentScrollY > 0) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: currentScrollY, behavior: 'instant' });
        });
      }
    };
  }, [isChatOpen]);

  // Đóng Drawer bằng phím ESC và dọn dẹp phiên sinh trắc học
  useEffect(() => {
    if (!isChatOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatOpen]);

  // Dọn dẹp phiên sinh trắc học khi Chatbox bị đóng qua bất kỳ luồng nào
  useEffect(() => {
    if (!isChatOpen) {
      setFpToken(null);
      setFpTokenExpiresAt(null);
      setTargetScanFileId('');
      setTargetScanDocCode('');
      setScanModalOpen(false);
      setPreviewOpen(false);
      if (typeof window !== 'undefined') {
        try {
          Object.keys(sessionStorage).forEach((key) => {
            if (key.startsWith('qk7_fp_token')) {
              sessionStorage.removeItem(key);
            }
          });
        } catch (_) {}
      }
    }
  }, [isChatOpen]);

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
      if (!customPrompt) {
        setInputText('');
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
        }
      }
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
        file_id: fileIdOverride,
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

  // 🖥️ Khi bấm vào xem tài liệu trích dẫn: Tự động kích hoạt Toàn màn hình (Full Screen) 100%
  const handleOpenPdf = (
    fileId: string,
    page: number = 1,
    docCode?: string,
    title?: string,
    secName?: string,
    requiresBio: boolean = false
  ) => {
    // Kích hoạt Fullscreen ngay lập tức trong user gesture event
    try {
      if (typeof window !== 'undefined' && !window.document.fullscreenElement) {
        window.document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (_) {}

    // Nếu mở file khác với file đã quét vân tay hoặc token đã quá 5 phút -> reset token
    const activeToken = getActiveFpToken(fileId);
    if (!activeToken && fileId !== targetScanFileId) {
      setFpToken(null);
      setFpTokenExpiresAt(null);
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
    if (validToken) {
      const expiresAt = Date.now() + 5 * 60 * 1000;
      setFpToken(validToken);
      setFpTokenExpiresAt(expiresAt);
    }

    toast.success(
      `Xác thực vân tay ZK9500 thành công! Đang lấy câu trả lời...`,
      { title: 'SINH TRẮC HỌC HỢP LỆ', duration: 3000 }
    );

    const queryToRetry = lastQuery || lastUserQueryRef.current || inputText.trim();
    if (queryToRetry) {
      setLoading(true);
      await handleSend(queryToRetry, validToken, true, targetScanFileId);
    } else if (targetScanFileId) {
      handleOpenPdf(targetScanFileId, 1, targetScanDocCode, undefined, 'Cấp 3 - Mật');
    }
  };

  // Các câu hỏi gợi ý tác chiến nhanh
  const quickPrompts = [
    'Quy định phân cấp bảo mật tài liệu 5 cấp độ',
    'Hướng dẫn sử dụng máy quét vân tay ZKTeco ZK9500',
    'Chính sách lưu trữ và tải văn bản Cấp 3 (Mật)',
  ];

  return (
    <>
      <AnimatePresence>
        {isChatOpen && (
          <div key="ai-chat-drawer-container" className="fixed inset-0 z-50 overflow-hidden select-none">
            {/* 1. LỚP PHỦ MỜ BACKDROP (backdrop-blur-sm bg-black/50 z-50) */}
            <motion.div
              key="ai-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={handleCloseChat}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs cursor-pointer"
              aria-label="Đóng khung chat trợ lý AI"
            />

            {/* 2. KHUNG CHAT TRƯỢT PHẢI (SLIDE-OVER DRAWER) - Đục 100%, không bị ám xám từ backdrop */}
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
              className="fixed top-0 right-0 bottom-0 w-full sm:w-[520px] md:w-[620px] lg:w-[700px] max-w-full flex flex-col bg-[#f8fafc] dark:bg-[#0b1120] border-l border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-50"
            >
              {/* HEADER KHUNG CHAT SANG TRỌNG & TƯƠI SÁNG Ở LIGHT MODE */}
              <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0f172a] shrink-0 shadow-2xs">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#14532d] via-[#166534] to-[#15803d] border border-amber-400/40 flex items-center justify-center text-white shadow-xs shrink-0">
                    <Bot className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      {/* ĐỔI TIÊU ĐỀ: Trợ lý AI - Trung Tâm dữ liệu số */}
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                        Trợ lý AI - Trung Tâm dữ liệu số
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          aiStatus === 'online'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                        }`}
                        title={aiStatus === 'online' ? 'DeepTutor Vector DB Sẵn Sàng' : 'Smart SQL Fallback'}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            aiStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                        <span>{aiStatus === 'online' ? 'DeepTutor RAG' : 'SQL Fallback'}</span>
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center space-x-1.5 mt-0.5">
                      <span>Trường Quân Sự QK7</span>
                      <span>•</span>
                      <span className="text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        {user?.clearance_name || `Cấp ${user?.clearance_level_id || 1}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
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
                      className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      aria-label="Làm mới hội thoại"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </Tooltip>

                  <button
                    type="button"
                    onClick={handleCloseChat}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    aria-label="Đóng khung chat (ESC)"
                    title="Đóng (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* DANH SÁCH TIN NHẮN (NỀN SÁNG SỦA SLATE-50 / SLATE-100, BONG BÓNG TRẮNG TINH KHÔI) */}
              <div
                className={`flex-1 ${
                  previewOpen ? 'overflow-hidden' : 'overflow-y-auto'
                } p-4 sm:p-5 space-y-4 scrollbar-thin select-text bg-[#f8fafc] dark:bg-[#0b1120] overscroll-contain`}
              >
                {/* Lời chào & gợi ý câu hỏi khi chưa có tin nhắn */}
                {messages.length === 0 && (
                  <div className="py-8 px-4 text-center space-y-5">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs">
                      <Sparkles className="w-7 h-7 stroke-[2]" />
                    </div>
                    <div className="space-y-1.5 max-w-sm mx-auto">
                      <h4 className="font-bold text-base text-slate-900 dark:text-white">
                        Trung Tâm Trợ Lý AI Tác Chiến QK7
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Hệ thống tra cứu thông minh tích hợp RAG, vector hóa dữ liệu quân sự và kiểm soát phân cấp bí mật 5 cấp độ.
                      </p>
                    </div>

                    {/* Khối gợi ý câu hỏi nhanh */}
                    <div className="space-y-2 pt-2 text-left max-w-md mx-auto">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                        Gợi ý tra cứu nhanh:
                      </div>
                      {quickPrompts.map((prompt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSend(prompt)}
                          className="w-full text-left p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-xs text-slate-700 dark:text-slate-300 font-medium transition-all duration-150 flex items-center justify-between group cursor-pointer shadow-2xs"
                        >
                          <span className="truncate pr-2">{prompt}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Danh sách tin nhắn đã gửi */}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} min-w-0 max-w-full`}
                  >
                    {/* Header nhỏ hiển thị vai trò */}
                    <div className="flex items-center gap-1.5 mb-1.5 px-1">
                      {msg.sender === 'user' ? (
                        <span className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-400 tracking-wider">
                          {user?.full_name || user?.username || 'Đồng chí'}
                        </span>
                      ) : (
                        /* ĐỔI TÊN VAI TRÒ: Đồng chí Trợ lý AI */
                        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-900 dark:text-emerald-400 tracking-wide">
                          <Bot className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Đồng chí Trợ lý AI</span>
                        </div>
                      )}
                      <span className="text-[9px] text-slate-400 dark:text-slate-500">
                        {msg.timestamp}
                      </span>
                    </div>

                    {/* Khung nội dung tin nhắn */}
                    <div
                      className={`w-fit max-w-[96%] sm:max-w-[92%] rounded-2xl p-4 sm:p-5 shadow-xs overflow-hidden break-words ${
                        msg.sender === 'user'
                          ? 'bg-[#15803d] dark:bg-[#166534] !text-white rounded-tr-xs border border-emerald-400/50 text-xs sm:text-[13px] leading-relaxed shadow-sm'
                          : isDark
                          ? 'bg-[#111827] text-slate-100 border border-slate-800 rounded-tl-xs shadow-sm'
                          : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-sm'
                      }`}
                    >
                      {/* Nội dung tin nhắn: User dùng plain text tương phản cao, AI dùng Structured Renderer có ngắt dòng tự nhiên */}
                      {msg.sender === 'user' ? (
                        <div className="whitespace-pre-wrap font-sans !text-white font-medium select-text">
                          {msg.text}
                        </div>
                      ) : (
                        <AIMessageRenderer
                          text={msg.text}
                          onOpenPage={(p) => {
                            const matchingCit = msg.citations?.find((c) => c.page === p) || msg.citations?.[0];
                            if (matchingCit) {
                              handleOpenPdf(
                                matchingCit.file_id,
                                p,
                                matchingCit.document_code,
                                matchingCit.title,
                                matchingCit.security_level_name
                              );
                            }
                          }}
                        />
                      )}

                      {/* NÚT QUÉT VÂN TAY NẾU CÓ CỜ requires_biometric */}
                      {msg.requires_biometric && (
                        <div className="mt-3.5">
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
                            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2.5 transition-all duration-200 bg-gradient-to-r from-[#991b1b] via-[#b91c1c] to-[#d97706] hover:from-[#b91c1c] hover:to-[#f59e0b] text-white shadow-md active:scale-[0.98] border border-amber-400/40 cursor-pointer"
                          >
                            <Fingerprint className="w-5 h-5 text-amber-300 animate-pulse flex-shrink-0" />
                            <span>Quét vân tay ZK9500 để giải mã câu trả lời</span>
                          </button>
                        </div>
                      )}

                      {/* CĂN CỨ VĂN BẢN TRÍCH DẪN & NÚT XEM TOÀN MÀN HÌNH */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-4 pt-3.5 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="text-[11px] font-extrabold tracking-wider uppercase text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Căn cứ văn bản trích dẫn ({msg.citations.length})</span>
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                              Chạm để mở Toàn màn hình
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {msg.citations.map((c, cIdx) => (
                              <button
                                key={cIdx}
                                type="button"
                                onClick={() =>
                                  handleOpenPdf(
                                    c.file_id,
                                    c.page,
                                    c.document_code,
                                    c.title,
                                    c.security_level_name,
                                    Boolean(c.requires_biometric)
                                  )
                                }
                                className={`w-full text-left p-3 rounded-xl border transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 group/cit ${
                                  isDark
                                    ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/60 hover:border-emerald-500/60'
                                    : 'bg-slate-50 hover:bg-emerald-50/70 border-slate-200 hover:border-emerald-300'
                                }`}
                                title="Bấm để xem văn bản toàn màn hình (Full Screen)"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-600/20 shrink-0">
                                        {c.document_code || 'VĂN BẢN'}
                                      </span>
                                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-500/10 shrink-0">
                                        Trang {c.page || 1}
                                      </span>
                                    </div>
                                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover/cit:text-emerald-600 dark:group-hover/cit:text-emerald-400 transition-colors mt-0.5">
                                      {c.title || c.document_code || 'Văn bản bảo mật'}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold shrink-0 shadow-xs group-hover/cit:scale-105 transition-transform">
                                  <Maximize2 className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Toàn màn hình</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Trạng thái đang tải câu trả lời */}
                {loading && (
                  <div className="flex items-center space-x-3 text-xs text-emerald-800 dark:text-emerald-400 p-3 bg-white dark:bg-emerald-950/30 rounded-2xl border border-emerald-500/30 shadow-xs animate-pulse">
                    <Spin size="small" />
                    <span className="font-semibold">
                      {lastQuery ? 'Đang giải mã và lập báo cáo câu trả lời...' : 'Trợ lý AI đang truy vấn kho văn bản số...'}
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* THANH NHẬP LIỆU GHIM CỐ ĐỊNH Ở ĐÁY (SẠCH SẼ, SÁNG SỦA Ở LIGHT MODE) */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shrink-0 shadow-2xs">
                <div
                  className={`flex items-end rounded-2xl px-3.5 py-2 border transition-all duration-200 ${
                    isDark
                      ? 'bg-[#111827] border-slate-700 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-600/25'
                      : 'bg-slate-50 border-slate-300 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/20'
                  }`}
                >
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Tra cứu quy định, văn thư, hỏi đáp kế hoạch tác chiến..."
                    className="flex-1 bg-transparent text-xs sm:text-sm focus:outline-none px-1 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 resize-none max-h-[120px] py-1.5 scrollbar-thin"
                    disabled={loading}
                  />

                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={loading || !inputText.trim()}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-white transition-all cursor-pointer shrink-0 mb-0.5 ${
                      inputText.trim() && !loading
                        ? 'bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:scale-105 active:scale-95 shadow-sm border border-amber-400/40'
                        : 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed text-slate-400'
                    }`}
                    title="Gửi câu hỏi (Enter)"
                    aria-label="Gửi câu hỏi"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-2">
                  Nhấn Enter để gửi • Shift + Enter để xuống dòng • Esc để đóng khung chat
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
        isAiCitation={true}
        initialToken={getActiveFpToken(previewDoc?.file_id)}
        onClose={() => {
          setPreviewOpen(false);
        }}
      />
    </>
  );
};

// ==========================================
// 🎨 BỘ RENDERER CẤU TRÚC CHO TIN NHẮN TRỢ LÝ AI
// ==========================================
interface AIMessageRendererProps {
  text: string;
  onOpenPage?: (page: number) => void;
}

/**
 * Tiền xử lý ngắt câu thông minh:
 * Tách biệt Lời chào báo cáo, Căn cứ pháp lý, và Giới thiệu nội dung thành các dòng/câu độc lập
 * Mang lại trải nghiệm như một người trợ lý quân sự đang trực tiếp nhắn tin trao đổi với người dùng.
 */
function preprocessConversationFlow(rawText: string): string {
  if (!rawText) return '';
  let text = rawText;

  // 1. Nhận diện dạng dồn cục:
  // "Báo cáo [Đồng chí ...], căn cứ theo [Số hiệu] (...), tại Trang [X] [p.X], nội dung quy định như sau:"
  // -> Tách thành 3 câu rõ ràng, mỗi câu trên một dòng riêng:
  text = text.replace(
    /(Báo cáo [^\n,;.]+?)[,;.]\s*(căn cứ theo\s+[\s\S]+?\[p\.\d+\])[,;.]\s*(nội dung quy định như sau:?)/i,
    '$1.\n\n$2.\n\n$3\n'
  );

  // 2. Nếu là dạng ngắn hơn: "Báo cáo ..., căn cứ theo ..."
  text = text.replace(
    /(Báo cáo [^\n,;.]+?)[,;.]\s+(căn cứ theo)/i,
    '$1.\n\nCăn cứ theo'
  );

  // 3. Nếu là dạng: "... tại Trang X [p.X], nội dung quy định như sau:"
  text = text.replace(
    /(\[p\.\d+\])[,;.]\s*(nội dung quy định như sau:?)/i,
    '$1.\n\n$2\n'
  );

  return text;
}

const AIMessageRenderer: React.FC<AIMessageRendererProps> = ({ text, onOpenPage }) => {
  if (!text) return null;

  // Tiền xử lý ngắt câu đối thoại tự nhiên
  const formattedText = preprocessConversationFlow(text);

  // Phân tích và chia nhỏ toàn bộ văn bản thành các khối cấu trúc trực quan
  const lines = formattedText.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Nhận diện Bảng Markdown (| Header 1 | Header 2 | ...)
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      const headerCols = tableLines[0]
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());

      const dataRows = tableLines.slice(2).map((tl) =>
        tl
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim())
      );

      blocks.push(
        <div
          key={`table-${i}`}
          className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 shadow-xs"
        >
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                {headerCols.map((h, hIdx) => (
                  <th key={hIdx} className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-700">
                    {renderInlineFormatted(h, onOpenPage)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
              {dataRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="hover:bg-emerald-500/5 transition-colors odd:bg-transparent even:bg-slate-500/[0.03]"
                >
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2.5 leading-relaxed font-sans">
                      {renderInlineFormatted(cell, onOpenPage)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 2. Nhận diện Khối mã lệnh Code Block (``` ... ```)
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Bỏ qua dòng ``` đóng
      blocks.push(
        <div
          key={`code-${i}`}
          className="my-3 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 text-slate-200 font-mono text-[11px] shadow-xs"
        >
          <div className="px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 font-sans flex items-center justify-between font-semibold">
            <span>DỮ LIỆU ĐẶC TẢ / MÃ LỆNH</span>
          </div>
          <pre className="p-3.5 overflow-x-auto scrollbar-thin font-mono leading-relaxed">
            {codeLines.join('\n')}
          </pre>
        </div>
      );
      continue;
    }

    // 3. Nhận diện Tiêu đề H3 (### ...)
    if (trimmed.startsWith('### ')) {
      const headingText = trimmed.replace(/^###\s+/, '');
      blocks.push(
        <div
          key={`h3-${i}`}
          className="flex items-center gap-2 mt-4 mb-1.5 pb-1 border-b border-emerald-500/20 text-emerald-950 dark:text-emerald-300 font-bold text-xs sm:text-sm"
        >
          <span className="w-1.5 h-3.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
          <span>{renderInlineFormatted(headingText, onOpenPage)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 4. Nhận diện Tiêu đề H2 (## ...)
    if (trimmed.startsWith('## ')) {
      const headingText = trimmed.replace(/^##\s+/, '');
      blocks.push(
        <div
          key={`h2-${i}`}
          className="flex items-center gap-2 mt-5 mb-2 text-slate-900 dark:text-white font-extrabold text-sm sm:text-base"
        >
          <span className="w-2 h-4 rounded-full bg-amber-500 shrink-0" />
          <span>{renderInlineFormatted(headingText, onOpenPage)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 5. Nhận diện Tiêu đề H1 (# ...)
    if (trimmed.startsWith('# ')) {
      const headingText = trimmed.replace(/^#\s+/, '');
      blocks.push(
        <div
          key={`h1-${i}`}
          className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-wide mt-5 mb-2.5 pb-1 border-b-2 border-emerald-600"
        >
          {renderInlineFormatted(headingText, onOpenPage)}
        </div>
      );
      i++;
      continue;
    }

    // 6. Nhận diện Khối trích dẫn văn bản / Bằng chứng (> ...)
    if (trimmed.startsWith('> ') || trimmed === '>') {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('> ') || lines[i].trim() === '>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ''));
        i++;
      }
      blocks.push(
        <div
          key={`quote-${i}`}
          className="my-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border-l-4 border-emerald-600 dark:border-emerald-500 text-xs text-slate-800 dark:text-slate-200 leading-relaxed flex items-start gap-2.5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs"
        >
          <Quote className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 opacity-80" />
          <div className="flex-1 space-y-1 font-sans">
            {quoteLines.map((ql, qIdx) => (
              <div key={qIdx}>{renderInlineFormatted(ql, onOpenPage)}</div>
            ))}
          </div>
        </div>
      );
      continue;
    }

    // 7. Nhận diện Danh sách gạch đầu dòng (- hoặc *)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const bulletItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        bulletItems.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-2.5 space-y-2 pl-1">
          {bulletItems.map((item, bIdx) => (
            <li
              key={bIdx}
              className="flex items-start gap-2.5 text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-2 shrink-0" />
              <div className="flex-1">{renderInlineFormatted(item, onOpenPage)}</div>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 8. Nhận diện Danh sách đánh số (1., 2., ...)
    if (/^\d+\.\s+/.test(trimmed)) {
      const numItems: { num: string; text: string }[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const match = lines[i].trim().match(/^(\d+)\.\s+(.*)$/);
        if (match) {
          numItems.push({ num: match[1], text: match[2] });
        }
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-2.5 space-y-2 pl-1">
          {numItems.map((item, nIdx) => (
            <li
              key={nIdx}
              className="flex items-start gap-2.5 text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed"
            >
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 mt-0.5 shrink-0">
                {item.num}
              </span>
              <div className="flex-1">{renderInlineFormatted(item.text, onOpenPage)}</div>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 9. Dòng trống
    if (!trimmed) {
      i++;
      continue;
    }

    // 10. Đoạn văn thông thường (Tách biệt rõ ràng, dễ đọc)
    blocks.push(
      <p
        key={`p-${i}`}
        className="text-xs sm:text-[13px] leading-relaxed text-slate-800 dark:text-slate-200 my-2 break-words"
      >
        {renderInlineFormatted(trimmed, onOpenPage)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{blocks}</div>;
};

// Hàm phân tích định dạng nội tuyến: In đậm, Mã nội tuyến, Trang trích dẫn
function renderInlineFormatted(
  text: string,
  onOpenPage?: (page: number) => void
): React.ReactNode {
  if (!text) return null;

  // Regex nhận diện **in đậm**, `mã`, [p.XX]
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[p\.\d+\])/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-bold text-emerald-950 dark:text-emerald-300">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-emerald-700 dark:text-emerald-400 border border-black/5 dark:border-white/10 break-all font-semibold"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (/^\[p\.\d+\]$/.test(part)) {
      const pageNum = parseInt(part.replace(/[^\d]/g, ''), 10);
      return (
        <button
          key={index}
          type="button"
          onClick={() => onOpenPage?.(pageNum)}
          className="inline-flex items-center gap-1 px-1.5 py-0.2 mx-0.5 rounded-md text-[10px] font-bold font-mono text-amber-900 bg-amber-500/15 border border-amber-600/30 dark:text-amber-300 dark:bg-amber-500/20 hover:bg-amber-500/30 transition-colors cursor-pointer align-baseline"
          title={`Bấm để mở xem Toàn màn hình tại trang ${pageNum}`}
        >
          📄 Trang {pageNum}
        </button>
      );
    }
    return part;
  });
}

export default AIChatDrawer;
