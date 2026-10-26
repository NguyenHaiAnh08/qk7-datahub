/* <!-- AI Chat Drawer Component --> */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Modal,
  Tabs,
  Radio,
  Tag,
  Spin,
  Alert,
  Tooltip,
  Button,
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
  ChevronDown,
  ChevronRight,
  BrainCircuit,
  Network,
  HelpCircle,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAIChat } from '../../contexts/AIChatContext';
import { aiService, AICitation, AIStudyBookResponse } from '../../services/aiService';
import { fileService } from '../../services/fileService';
import { toast } from '../common/Toast';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  citations?: AICitation[];
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
  '⚡ Quy trình lưu trữ và băm tệp SHA-256',
];

export const AIChatDrawer: React.FC = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { isChatOpen, setIsChatOpen, aiStatus, setAiStatus } = useAIChat();

  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});

  // State cho Modal "02 Sơ đồ"
  const [diagramModalVisible, setDiagramModalVisible] = useState<boolean>(false);
  const [studyBookData, setStudyBookData] = useState<AIStudyBookResponse | null>(null);
  const [loadingStudyBook, setLoadingStudyBook] = useState<boolean>(false);

  // State cho Modal "03 Kiểm tra"
  const [quizModalVisible, setQuizModalVisible] = useState<boolean>(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [submittedQuiz, setSubmittedQuiz] = useState<boolean>(false);

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

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInputText('');
    setLoading(true);

    try {
      const res = await aiService.chat({ query: textToSend });
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: res.answer || 'Xin lỗi, không có câu trả lời từ máy chủ.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        citations: res.citations || [],
        reasoning: res.reasoning,
      };
      setMessages((prev) => [...prev, aiMsg]);
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

  const handleOpenPdf = (fileId: string, page: number = 1) => {
    try {
      const url = fileService.getViewUrl(fileId, '0');
      const targetUrl = `${url}#page=${page}`;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(`Không thể mở tệp: ${err.message}`, { title: 'TRUY CẬP TỆP THẤT BẠI' });
    }
  };

  const fetchStudyBook = async (fileId: string) => {
    setLoadingStudyBook(true);
    try {
      const data = await aiService.getStudyBook(fileId);
      setStudyBookData(data);
      setSelectedAnswers({});
      setSubmittedQuiz(false);
      return data;
    } catch (err: any) {
      toast.error(`Lỗi tải dữ liệu cuốn sách: ${err.message}`, { title: 'LỖI STUDY BOOK' });
      return null;
    } finally {
      setLoadingStudyBook(false);
    }
  };

  const handleOpenDiagram = async (fileId: string) => {
    setDiagramModalVisible(true);
    await fetchStudyBook(fileId);
  };

  const handleOpenQuiz = async (fileId: string) => {
    setQuizModalVisible(true);
    await fetchStudyBook(fileId);
  };

  const handleSelectAnswer = (qId: number, answerKey: string) => {
    if (submittedQuiz) return;
    setSelectedAnswers((prev) => ({ ...prev, [qId]: answerKey }));
  };

  const handleSubmitQuiz = () => {
    if (!studyBookData?.tab_quiz) return;
    const answeredCount = Object.keys(selectedAnswers).length;
    if (answeredCount < studyBookData.tab_quiz.length) {
      toast.warning(`Đồng chí vui lòng hoàn thành tất cả ${studyBookData.tab_quiz.length} câu hỏi trước khi nộp bài.`, {
        title: 'CHƯA HOÀN THÀNH BÀI THI',
        badge: 'QUIZ',
      });
      return;
    }
    setSubmittedQuiz(true);
  };

  const toggleReasoning = (msgId: string) => {
    setExpandedReasoning((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
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

                    <div className="space-y-1.5 text-left pt-2">
                      <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
                        Câu hỏi thường gặp:
                      </div>
                      {QUICK_PROMPTS.map((prompt, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => handleSend(prompt)}
                          className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/60 dark:bg-slate-900/60 dark:hover:bg-emerald-950/30 border border-slate-200/80 hover:border-emerald-500/40 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all cursor-pointer shadow-2xs"
                        >
                          {prompt}
                        </button>
                      ))}
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

                      {/* Phân tích suy luận AI (Reasoning / Think) */}
                      {msg.reasoning && (msg.reasoning.think || msg.reasoning.tool_call) && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/40 dark:border-slate-800/60">
                          <button
                            type="button"
                            onClick={() => toggleReasoning(msg.id)}
                            className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            <BrainCircuit className="w-3 h-3" />
                            <span>
                              {expandedReasoning[msg.id] ? 'Thu gọn suy luận' : 'Xem chuỗi suy luận AI'}
                            </span>
                            {expandedReasoning[msg.id] ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </button>
                          {expandedReasoning[msg.id] && (
                            <div className="mt-1.5 p-2 rounded-lg bg-slate-900/10 dark:bg-black/30 font-mono text-[10px] text-slate-600 dark:text-slate-400 space-y-1">
                              {msg.reasoning.think && <div>{msg.reasoning.think}</div>}
                              {msg.reasoning.tool_call && (
                                <div className="text-amber-600 dark:text-amber-400 font-semibold">
                                  Lệnh gọi công cụ: {msg.reasoning.tool_call}
                                </div>
                              )}
                            </div>
                          )}
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
                                onClick={() => handleOpenPdf(c.file_id, c.page)}
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

                              {/* Nút Sơ đồ & Kiểm tra nếu khả dụng */}
                              <div className="flex gap-1.5 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDiagram(c.file_id)}
                                  className="flex-1 py-1 px-1.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center justify-center gap-1 transition cursor-pointer"
                                >
                                  <Network className="w-2.5 h-2.5" />
                                  <span>02 Sơ đồ</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenQuiz(c.file_id)}
                                  className="flex-1 py-1 px-1.5 rounded-md text-[10px] font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center justify-center gap-1 transition cursor-pointer"
                                >
                                  <HelpCircle className="w-2.5 h-2.5" />
                                  <span>03 Kiểm tra</span>
                                </button>
                              </div>
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
                  <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 pl-2">
                    <Spin size="small" />
                    <span>Trợ lý AI đang tra cứu kho dữ liệu số...</span>
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

      {/* 3. MODAL "02 SƠ ĐỒ" */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-400 font-bold">
            <Network className="w-4 h-4" />
            <span>02 Sơ Đồ Tổ Chức & Luồng Chỉ Đạo</span>
          </div>
        }
        open={diagramModalVisible}
        onCancel={() => setDiagramModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDiagramModalVisible(false)}>
            Đóng
          </Button>,
        ]}
        width={700}
        destroyOnHidden
      >
        {loadingStudyBook ? (
          <div className="py-12 text-center space-y-3">
            <Spin size="large" />
            <div className="text-sm text-slate-500">Đang khởi tạo sơ đồ tổ chức tác chiến...</div>
          </div>
        ) : studyBookData ? (
          <div className="space-y-4 py-2">
            <Alert
              type="info"
              showIcon
              message={studyBookData.title || studyBookData.document_code}
              description={`Mã tệp: ${studyBookData.file_id} • Số trang: ${studyBookData.total_pages}`}
            />
            {studyBookData.tab_diagram && (
              <div className="p-4 bg-slate-900 rounded-xl overflow-x-auto text-slate-200 font-mono text-xs border border-slate-700">
                <pre>{studyBookData.tab_diagram.mermaid_code || studyBookData.tab_diagram.description}</pre>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">Không có sơ đồ cho văn bản này.</div>
        )}
      </Modal>

      {/* 4. MODAL "03 KIỂM TRA" */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 font-bold">
            <HelpCircle className="w-4 h-4" />
            <span>03 Trắc Nghiệm Nhận Thức Tác Chiến</span>
          </div>
        }
        open={quizModalVisible}
        onCancel={() => setQuizModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setQuizModalVisible(false)}>
            Đóng
          </Button>,
          !submittedQuiz && (
            <Button
              key="submit"
              type="primary"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSubmitQuiz}
            >
              Nộp bài kiểm tra
            </Button>
          ),
        ]}
        width={720}
        destroyOnHidden
      >
        {loadingStudyBook ? (
          <div className="py-12 text-center space-y-3">
            <Spin size="large" />
            <div className="text-sm text-slate-500">Đang tạo bộ câu hỏi kiểm tra...</div>
          </div>
        ) : studyBookData?.tab_quiz ? (
          <div className="space-y-4 py-2">
            {studyBookData.tab_quiz.map((q, qIndex) => (
              <div
                key={q.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-2.5"
              >
                <div className="font-semibold text-xs text-slate-900 dark:text-white">
                  Câu {qIndex + 1}: {q.question}
                </div>
                <div className="space-y-1.5 pl-2">
                  {Object.entries(q.options).map(([optKey, optText]) => {
                    const isSelected = selectedAnswers[q.id] === optKey;
                    const isCorrect = q.correct_answer === optKey;
                    let optionStyle = 'text-slate-700 dark:text-slate-300';
                    if (submittedQuiz) {
                      if (isCorrect) optionStyle = 'text-emerald-600 font-bold';
                      else if (isSelected && !isCorrect) optionStyle = 'text-rose-600 line-through';
                    }
                    return (
                      <label
                        key={optKey}
                        className={`flex items-center gap-2 text-xs cursor-pointer ${optionStyle}`}
                      >
                        <input
                          type="radio"
                          name={`quiz-q-${q.id}`}
                          value={optKey}
                          checked={isSelected}
                          onChange={() => handleSelectAnswer(q.id, optKey)}
                          disabled={submittedQuiz}
                        />
                        <span>
                          <strong className="uppercase">{optKey}.</strong> {optText}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">Không có đề kiểm tra.</div>
        )}
      </Modal>
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
