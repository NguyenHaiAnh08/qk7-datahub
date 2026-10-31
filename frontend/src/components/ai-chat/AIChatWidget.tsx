import React, { useState, useEffect, useRef } from 'react';
import {
  Tooltip,
  Spin
} from 'antd';
import {
  MessageOutlined,
  CloseOutlined,
  SendOutlined,
  FilePdfOutlined,
  RobotOutlined,
  ReloadOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  LockOutlined
} from '@ant-design/icons';
import { Fingerprint } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
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

const QUICK_PROMPTS = [
  '📋 Tóm tắt các văn bản mới nhất',
  '🔒 Quy định 5 cấp độ bảo mật quân sự',
  '🎯 Kế hoạch tác chiến và huấn luyện',
  '⚡ Quy trình lưu trữ và băm tệp SHA-256'
];

export const AIChatWidget: React.FC = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiStatus, setAiStatus] = useState<'online' | 'fallback' | 'checking'>('checking');


  // State cho Khóa Bảo Vệ Sinh Trắc Học Vân Tay ZK9500 (Biometric AI Guard)
  const [scanModalOpen, setScanModalOpen] = useState<boolean>(false);
  const [targetScanFileId, setTargetScanFileId] = useState<string>('');
  const [targetScanDocCode, setTargetScanDocCode] = useState<string>('');

  // State cho Modal Xem trước PDF an toàn (Blob URL qua fetch có kèm X-Fingerprint-Token)
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  // State lưu token vân tay đã xác thực trong phiên làm việc
  const [fpToken, setFpToken] = useState<string | null>(null);
  // Lưu câu hỏi gần nhất của user để auto-retry sau khi quét vân tay
  const [lastQuery, setLastQuery] = useState<string>('');
  const lastUserQueryRef = useRef<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Cố định vị trí khung chat ở góc dưới bên trái (ngay trên nút chat) ──
  const popupWidth = isExpanded ? 520 : 390;
  const popupHeight = isExpanded ? 720 : 580;

  const getPopupStyle = (): React.CSSProperties => {
    if (typeof window === 'undefined') {
      return { position: 'fixed', bottom: 84, right: 20, zIndex: 35 };
    }

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    const actualW = Math.min(popupWidth, screenW - 32);
    const actualH = Math.min(popupHeight, screenH - 100);

    return {
      position: 'fixed',
      right: '20px',
      bottom: '84px',
      width: `${actualW}px`,
      height: `${actualH}px`,
      maxHeight: 'calc(100dvh - 5.5rem)',
      maxWidth: 'calc(100vw - 32px)',
      zIndex: 35,
      boxShadow: isDark
        ? '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(114, 46, 209, 0.25)'
        : '0 25px 50px -12px rgba(114, 46, 209, 0.2), 0 0 20px rgba(0,0,0,0.06)'
    };
  };

  // CHỈ kiểm tra sức khỏe của AI microservice & DB Fallback khi người dùng mở hộp chat
  useEffect(() => {
    if (isOpen) {
      checkServiceStatus();
    }
  }, [isOpen]);

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

  // Cuộn xuống tin nhắn mới nhất
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Tin nhắn chào mừng ban đầu
  useEffect(() => {
    if (messages.length === 0) {
      const clearanceLevel = user?.clearance_level_id || 1;
      const clearanceName = user?.clearance_name || `Cấp ${clearanceLevel}`;
      setMessages([
        {
          id: 'welcome',
          sender: 'ai',
          text: `Báo cáo đồng chí ${user?.full_name || 'quân nhân'}! Tôi là **Trợ Lý AI Tác Chiến & Văn Thư QK7**.\n\nHệ thống đang hoạt động với cấp quyền bảo mật: **${clearanceName} (Cấp ${clearanceLevel})**. Mọi thông tin tra cứu đều được kiểm soát độ mật nghiêm ngặt và trích dẫn chuẩn xác số trang [p.X]. Đồng chí cần tôi hỗ trợ nội dung gì?`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [user]);

  // Gửi tin nhắn (hỗ trợ Auto-retry khi quét vân tay ZK9500 thành công)
  // ✅ SỬA: Thêm tham số fileIdOverride để truyền file_id lên Backend kiểm tra chéo token
  const handleSend = async (
    queryText?: string,
    tokenOverride?: string,
    isRetry: boolean = false,
    fileIdOverride?: string
  ) => {
    const textToSend = (queryText || inputText).trim();
    if (!textToSend || (loading && !isRetry)) return;

    setLastQuery(textToSend);
    lastUserQueryRef.current = textToSend;

    if (!isRetry) {
      const userMsg: ChatMessage = {
        id: `usr_${Date.now()}`,
        sender: 'user',
        text: textToSend,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputText('');
    }

    setLoading(true);

    // Lấy 6 lượt lịch sử trao đổi gần nhất
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
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: res.answer,
        citations: res.citations,
        requires_biometric: res.requires_biometric,
        reasoning: res.reasoning,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };

      if (isRetry) {
        // Cập nhật đè lên bong bóng AI gần nhất đang chờ xác thực
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
        id: `err_${Date.now()}`,
        sender: 'ai',
        text: `Báo cáo đồng chí, hệ thống gặp gián đoạn tạm thời: ${err.message || 'Lỗi kết nối'}. Vui lòng thử lại.`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Mở hộp thoại quét vân tay ZK9500 cho thẻ trích dẫn Cấp 3-5
  const handleOpenFingerprintScan = (fileId?: string, docCode?: string) => {
    setTargetScanFileId(fileId || '');
    setTargetScanDocCode(docCode || 'Văn kiện Mật');
    setScanModalOpen(true);
  };

  // Callback khi Local Agent :9001 và Gateway xác thực vân tay thành công
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
      { title: 'SINH TRẮC HỌC HỢP LỆ', badge: 'ZK9500', duration: 3000 }
    );

    // Tự động retry câu hỏi gần nhất
    const queryToRetry = lastQuery || lastUserQueryRef.current || inputText.trim();
    if (queryToRetry) {
      setLoading(true);
      // ✅ SỬA: Truyền targetScanFileId vào để Backend kiểm tra chéo token-file
      await handleSend(queryToRetry, validToken, true, targetScanFileId);
    } else if (targetScanFileId) {
      handleOpenPdf(targetScanFileId, 1, targetScanDocCode, undefined, 'Cấp 3 - Mật');
    }
  };

  // Mở tài liệu PDF an toàn qua DocumentPreviewModal (không mở tab mới gây lỗi 403)
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


  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          1. NÚT TRÒN MỞ CHAT CỐ ĐỊNH Ở GÓC DƯỚI BÊN PHẢI (fixed bottom-5 right-5, z-30)
      ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          right: '20px',
          bottom: '20px',
          zIndex: 30,
          userSelect: 'none',
        }}
        className="transition-transform duration-200"
      >
        <Tooltip
          title={isOpen ? 'Đóng hộp thoại AI' : 'Trợ lý AI Tác chiến & Dữ liệu QK7'}
          placement="left"
          open={isOpen ? false : undefined}
        >
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="
              relative w-14 h-14 rounded-full flex items-center justify-center text-white
              shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer
              bg-gradient-to-tr from-[#14532d] via-[#166534] to-[#15803d]
              border-2 border-amber-500/35
              focus:outline-none focus:ring-4 focus:ring-emerald-500/30
            "
            style={{
              boxShadow: isDark
                ? '0 10px 25px -5px rgba(16, 185, 129, 0.4), 0 0 15px rgba(245, 158, 11, 0.25)'
                : '0 10px 25px -5px rgba(22, 101, 52, 0.35)'
            }}
          >
            {isOpen ? (
              <CloseOutlined className="text-xl" />
            ) : (
              <MessageOutlined className="text-2xl" />
            )}

            {/* Chấm xanh báo Online */}
            <span className="absolute top-0 right-0 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
            </span>
          </button>
        </Tooltip>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. KHUNG POPUP CHAT (bo góc 26px, Dark/Light, Tọa độ thông minh)
      ───────────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className={`
            flex flex-col overflow-hidden transition-all duration-300
            rounded-[26px] shadow-2xl max-h-[calc(100dvh-5rem)]
            ${isDark ? 'bg-[#090e17] border border-emerald-900/40 text-slate-100' : 'bg-[#ffffff] border border-emerald-200 text-slate-900'}
          `}
          style={getPopupStyle()}
        >
          {/* HEADER KHUNG CHAT */}
          <div
            className={`
              px-4 py-3.5 flex items-center justify-between border-b
              ${isDark ? 'bg-gradient-to-r from-[#0d1f16] to-[#090e17] border-emerald-900/30' : 'bg-gradient-to-r from-[#f0fdf4] to-[#ffffff] border-emerald-100'}
            `}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#14532d] via-[#166534] to-[#15803d] border border-amber-500/30 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                <RobotOutlined className="text-base" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-sm truncate">Trợ Lý AI Tác Chiến</span>
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${aiStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    title={aiStatus === 'online' ? 'DeepTutor Agentic Online' : 'Smart SQL Database Mode'}
                  />
                </div>
                <div className="text-[11px] opacity-75 truncate flex items-center space-x-1">
                  <span>Trường Quân Sự QK7</span>
                  <span>•</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {user?.clearance_name || `Cấp ${user?.clearance_level_id || 1}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1 text-slate-400">
              <Tooltip title="Làm mới hội thoại">
                <button
                  onClick={() => {
                    setMessages([]);
                    toast.success('Đã làm mới phiên hội thoại với Trợ lý AI.', { title: 'PHIÊN MỚI', badge: 'AI-RESET' });
                  }}
                  className="p-1.5 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors btn-tactile active:scale-95 cursor-pointer"
                >
                  <ReloadOutlined className="text-xs" />
                </button>
              </Tooltip>

              <Tooltip title={isExpanded ? 'Thu nhỏ' : 'Mở rộng'}>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors"
                >
                  {isExpanded ? (
                    <FullscreenExitOutlined className="text-xs" />
                  ) : (
                    <FullscreenOutlined className="text-xs" />
                  )}
                </button>
              </Tooltip>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors"
              >
                <CloseOutlined className="text-xs" />
              </button>
            </div>
          </div>

          {/* DANH SÁCH TIN NHẮN */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* BONG BÓNG TIN NHẮN */}
                <div
                  className={`
                    max-w-[90%] rounded-[18px] px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm
                    ${
                      msg.sender === 'user'
                        ? isDark
                          ? 'bg-[#14532d] text-white rounded-br-none border border-emerald-600/30'
                          : 'bg-[#166534] text-white rounded-br-none shadow-sm'
                        : isDark
                          ? 'bg-[#111827] text-slate-100 border border-emerald-800/40 rounded-bl-none'
                          : 'bg-[#f0fdf4] text-[#14532d] border border-[#86efac] rounded-bl-none'
                    }
                  `}
                >
                  {/* Nội dung tin nhắn (hỗ trợ markdown đơn giản) */}
                  <div className="whitespace-pre-wrap font-sans">
                    {msg.text.split('\n').map((line, lIdx) => (
                      <p key={lIdx} className={lIdx > 0 ? 'mt-1.5' : ''}>
                        {renderFormattedText(line)}
                      </p>
                    ))}
                  </div>

                  {/* NÚT QUÉT VÂN TAY ĐỂ XEM NẾU CÓ CỜ requires_biometric Ở CẤP ROOT (chỉ hiện khi chưa có token) */}
                  {msg.requires_biometric && (
                    <div className="mt-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          const targetCitation = msg.citations?.find((c) => c.requires_biometric);
                          const fid = targetCitation?.file_id || targetScanFileId || '';
                          const code = targetCitation?.document_code || 'Văn bản bảo mật';
                          handleOpenFingerprintScan(fid, code);
                        }}
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all duration-200 bg-gradient-to-r from-[#991b1b] via-[#b91c1c] to-[#d97706] hover:from-[#b91c1c] hover:to-[#f59e0b] text-white shadow-md active:scale-[0.98] border border-amber-400/40 cursor-pointer"
                      >
                        <Fingerprint className="w-4 h-4 text-amber-300 animate-pulse flex-shrink-0" />
                        <span>Quét vân tay để nhận câu trả lời</span>
                      </button>
                    </div>
                  )}

                  {/* CĂN CỨ VĂN BẢN TRÍCH DẪN & HÀNH ĐỘNG TINH GỌN */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-white/20 dark:border-white/15 space-y-2">
                      <div className="text-[11px] font-semibold tracking-wide uppercase opacity-90 flex items-center justify-between">
                        <span>📑 Căn cứ văn bản trích dẫn ({msg.citations.length}):</span>
                      </div>

                      {msg.citations.map((c, cIdx) => {
                        const isBiometricLocked =
                          Boolean(c.requires_biometric) ||
                          (c.snippet && c.snippet.includes('[Nội dung Mật'));

                        if (isBiometricLocked) {
                          return (
                            <div
                              key={cIdx}
                              className={`
                                p-3 rounded-xl border transition-all duration-200 space-y-2
                                ${
                                  isDark
                                    ? 'bg-gradient-to-br from-red-950/50 via-[#1a0f0f] to-slate-900 border-red-700/60 shadow-md'
                                    : 'bg-gradient-to-br from-red-50/90 via-amber-50/40 to-white border-red-300 shadow-sm'
                                }
                              `}
                            >
                              {/* Hàng 1: Tiêu đề / Số hiệu văn bản & Số trang + Mức độ bảo mật */}
                              <div className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center space-x-1.5 truncate">
                                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-600/20 text-red-500 dark:text-red-400 flex-shrink-0">
                                    <LockOutlined className="text-xs" />
                                  </span>
                                  <span className="text-xs font-bold text-red-700 dark:text-red-400 truncate">
                                    Trang {c.page} • [{c.document_code || c.file_id}]
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-300 border border-red-500/30 flex-shrink-0">
                                  {c.security_level_name || 'Cấp 3 - Mật'}
                                </span>
                              </div>

                              {/* Hàng 2: Trạng thái khóa sinh trắc học */}
                              <div className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300 italic px-1 line-clamp-2">
                                "{c.snippet || '🔒 [Tài liệu Mật] - Yêu cầu xác thực vân tay ZK9500 để xem chi tiết'}"
                              </div>

                              {/* Hàng 3: Nút bấm kích hoạt hộp thoại quét vân tay (Touch Target >= 44x44px Apple HIG) */}
                              <button
                                type="button"
                                onClick={() => handleOpenFingerprintScan(c.file_id, c.document_code)}
                                className={`
                                  w-full min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold
                                  flex items-center justify-center space-x-2 transition-all duration-200
                                  bg-gradient-to-r from-[#991b1b] via-[#b91c1c] to-[#d97706] hover:from-[#b91c1c] hover:to-[#f59e0b]
                                  text-white shadow-md active:scale-[0.98] border border-amber-400/40 cursor-pointer
                                `}
                              >
                                <Fingerprint className="w-4 h-4 text-amber-300 animate-pulse flex-shrink-0" />
                                <span className="truncate">Nhấn để quét vân tay ZK9500 mở khóa nội dung</span>
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={cIdx}
                            className={`
                              p-3 rounded-xl border transition-all duration-200 space-y-2
                              ${
                                isDark
                                  ? 'bg-slate-900/80 border-emerald-800/40 hover:border-emerald-600/60'
                                  : 'bg-white border-emerald-200 hover:border-emerald-400 shadow-xs'
                              }
                            `}
                          >
                            {/* Hàng 1: Tiêu đề / Số hiệu văn bản & Số trang + Mức độ bảo mật */}
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center space-x-1.5 truncate">
                                <FilePdfOutlined className="text-red-500 flex-shrink-0 text-sm" />
                                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 truncate">
                                  Trang {c.page} • [{c.document_code || c.file_id}]
                                </span>
                                <span className="text-[10px] opacity-75 font-mono text-slate-500 dark:text-slate-400">
                                  [p.{c.page}]
                                </span>
                              </div>
                              <span
                                className={`
                                  text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full flex-shrink-0 border
                                  ${
                                    isDark
                                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  }
                                `}
                              >
                                {c.security_level_name || 'Cấp 1 - Công khai'}
                              </span>
                            </div>

                            {/* Hàng 2: Nội dung tóm tắt trích dẫn (snippet) */}
                            {c.snippet && (
                              <div className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300 px-1 line-clamp-2">
                                "{c.snippet}"
                              </div>
                            )}

                            {/* Hàng 3: Nút bấm mở xem file PDF tại đúng trang (Touch target >= 40px) */}
                            <button
                              type="button"
                              onClick={() => handleOpenPdf(c.file_id, c.page, c.document_code, c.title, c.security_level_name, false)}
                              className={`
                                w-full min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold
                                flex items-center justify-center space-x-1.5 transition-all duration-200 cursor-pointer active:scale-[0.98]
                                ${
                                  isDark
                                    ? 'bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-200 border border-emerald-700/40'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-[#166534] border border-emerald-300 shadow-xs'
                                }
                              `}
                            >
                              <FilePdfOutlined className="text-red-500 flex-shrink-0" />
                              <span className="truncate">Mở văn kiện tại Trang {c.page} [p.{c.page}]</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}


                </div>

                <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}

            {/* Trạng thái đang tải */}
            {loading && (
              <div className="flex items-center space-x-2 text-xs text-emerald-600 dark:text-emerald-400 p-2 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-500/20 animate-pulse">
                <Spin size="small" />
                <span className="font-medium">
                  {lastQuery ? 'Đang lấy câu trả lời...' : 'Trợ lý AI đang tra cứu kho dữ liệu số...'}
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* GỢI Ý CÂU HỎI NHANH */}
          {messages.length <= 2 && (
            <div className="px-3 py-1.5 flex flex-wrap gap-1.5 border-t border-emerald-500/15">
              {QUICK_PROMPTS.map((prompt, pIdx) => (
                <button
                  key={pIdx}
                  onClick={() => handleSend(prompt)}
                  disabled={loading}
                  className={`
                    text-[11px] px-2.5 py-1 rounded-full transition-colors truncate max-w-full
                    ${
                      isDark
                        ? 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-800/40'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                    }
                  `}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Ô NHẬP LIỆU CHAT DƯỚI CÙNG */}
          <div
            className={`
              p-3 border-t
              ${isDark ? 'bg-[#090e17] border-emerald-900/30' : 'bg-[#ffffff] border-emerald-100'}
            `}
          >
            <div
              className={`
                flex items-center rounded-full px-3 py-1.5 border transition-all duration-200
                ${
                  isDark
                    ? 'bg-[#111827] border-emerald-700/60 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-600/30'
                    : 'bg-[#ffffff] border-emerald-300 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/30'
                }
              `}
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
                placeholder="Tra cứu văn thư hoặc hỏi đáp tác chiến..."
                className={`
                  flex-1 bg-transparent text-xs focus:outline-none px-1
                  ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}
                `}
                disabled={loading}
              />

              <button
                onClick={() => handleSend()}
                disabled={loading || !inputText.trim()}
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-white transition-all
                  ${
                    inputText.trim() && !loading
                      ? 'bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] active:scale-95 shadow-sm border border-amber-500/30'
                      : 'bg-slate-400/40 cursor-not-allowed text-slate-300'
                  }
                `}
              >
                <SendOutlined className="text-xs" />
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ─────────────────────────────────────────────────────────────
          3. MODAL QUÉT VÂN TAY QUANG HỌC ZK9500 (BIOMETRIC AI GUARD)
      ───────────────────────────────────────────────────────────── */}
      <FingerprintScanModal
        open={scanModalOpen}
        fileId={targetScanFileId}
        onSuccess={handleFingerprintSuccess}
        onCancel={() => setScanModalOpen(false)}
      />

      {/* 4. MODAL XEM TRƯỚC VĂN BẢN PDF BẢO MẬT (BLOB URL + EMBED) */}
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

// Helper: Định dạng text đơn giản (bold, blockquote, [p.X])
function renderFormattedText(text: string): React.ReactNode {
  if (!text) return null;

  // Thay thế **bold**
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

export default AIChatWidget;