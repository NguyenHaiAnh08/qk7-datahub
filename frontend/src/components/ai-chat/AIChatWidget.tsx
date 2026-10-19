import React, { useState, useEffect, useRef } from 'react';
import {
  Button,
  Input,
  Tooltip,
  Badge,
  Modal,
  Tabs,
  Radio,
  Tag,
  Spin,
  Alert,
  Collapse,
  Space,
  Typography,
  message
} from 'antd';
import {
  MessageOutlined,
  CloseOutlined,
  SendOutlined,
  FilePdfOutlined,
  ApartmentOutlined,
  FormOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RobotOutlined,
  ReloadOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  CopyOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { aiService, AIChatResponse, AICitation, AIStudyBookResponse, AIQuizQuestion } from '../../services/aiService';
import { fileService } from '../../services/fileService';

const { Text, Paragraph, Title } = Typography;

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

  // State cho Modal "02 Sơ đồ"
  const [diagramModalVisible, setDiagramModalVisible] = useState<boolean>(false);
  const [studyBookData, setStudyBookData] = useState<AIStudyBookResponse | null>(null);
  const [loadingStudyBook, setLoadingStudyBook] = useState<boolean>(false);

  // State cho Modal "03 Kiểm tra"
  const [quizModalVisible, setQuizModalVisible] = useState<boolean>(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [submittedQuiz, setSubmittedQuiz] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Vị trí có thể kéo thả (Draggable) của bong bóng chat ──
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    try {
      const saved = localStorage.getItem('qk7_ai_chat_bubble_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          typeof parsed.x === 'number' &&
          typeof parsed.y === 'number' &&
          parsed.x >= 0 &&
          parsed.x <= window.innerWidth - 60 &&
          parsed.y >= 0 &&
          parsed.y <= window.innerHeight - 60
        ) {
          return parsed;
        }
      }
    } catch {}
    return {
      x: Math.max(16, window.innerWidth - 24 - 56),
      y: Math.max(16, window.innerHeight - 96 - 56),
    };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  }>({ startX: 0, startY: 0, origX: 0, origY: 0, moved: false });
  const justDraggedRef = useRef(false);
  const currentPosRef = useRef<{ x: number; y: number }>(pos);

  useEffect(() => {
    currentPosRef.current = pos;
  }, [pos]);

  // Giữ bong bóng trong màn hình khi thay đổi kích thước cửa sổ
  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => {
        const next = {
          x: Math.min(Math.max(16, prev.x), window.innerWidth - 56 - 16),
          y: Math.min(Math.max(16, prev.y), window.innerHeight - 56 - 16),
        };
        currentPosRef.current = next;
        return next;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: currentPosRef.current.x,
      origY: currentPosRef.current.y,
      moved: false,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const dy = moveEvent.clientY - dragStartRef.current.startY;

      if (!dragStartRef.current.moved && Math.hypot(dx, dy) > 4) {
        dragStartRef.current.moved = true;
        setIsDragging(true);
      }

      if (dragStartRef.current.moved) {
        const nextX = Math.min(
          Math.max(16, dragStartRef.current.origX + dx),
          window.innerWidth - 56 - 16
        );
        const nextY = Math.min(
          Math.max(16, dragStartRef.current.origY + dy),
          window.innerHeight - 56 - 16
        );
        currentPosRef.current = { x: nextX, y: nextY };
        setPos({ x: nextX, y: nextY });
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      if (dragStartRef.current.moved) {
        justDraggedRef.current = true;
        setIsDragging(false);
        try {
          localStorage.setItem('qk7_ai_chat_bubble_pos', JSON.stringify(currentPosRef.current));
        } catch {}
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 120);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleToggleOpen = () => {
    if (justDraggedRef.current) return;
    setIsOpen(!isOpen);
  };

  // Tính toán vị trí thông minh cho khung chat dựa trên vị trí bong bóng
  const popupWidth = isExpanded ? 520 : 390;
  const popupHeight = isExpanded ? 720 : 580;

  const getPopupStyle = (): React.CSSProperties => {
    if (typeof window === 'undefined') {
      return { position: 'fixed', bottom: 160, right: 24, zIndex: 99999 };
    }

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    const actualW = Math.min(popupWidth, screenW - 32);
    const actualH = Math.min(popupHeight, screenH - 100);

    // X: Ưu tiên căn theo lề phải của bong bóng nếu nằm bên phải màn hình, hoặc lề trái nếu nằm bên trái
    let left = pos.x + 56 - actualW;
    if (pos.x < screenW / 2) {
      left = pos.x;
    }
    if (left < 16) left = 16;
    if (left + actualW > screenW - 16) left = screenW - actualW - 16;

    // Y: Nếu bong bóng ở nửa dưới màn hình -> Mở lên trên; nếu ở nửa trên -> Mở xuống dưới
    let top = 0;
    if (pos.y > screenH / 2) {
      top = pos.y - actualH - 12;
      if (top < 16) top = 16;
    } else {
      top = pos.y + 56 + 12;
      if (top + actualH > screenH - 16) top = screenH - actualH - 16;
    }

    return {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      width: `${actualW}px`,
      height: `${actualH}px`,
      zIndex: 99999,
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

  // Gửi tin nhắn
  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || inputText).trim();
    if (!textToSend || loading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const res = await aiService.chat({ query: textToSend });
      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: res.answer,
        citations: res.citations,
        reasoning: res.reasoning,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'ai',
        text: `Báo cáo đồng chí, hệ thống gặp gián đoạn tạm thời. Vui lòng thử lại sau giây lát.`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Nút 1: Mở PDF tại đúng trang
  const handleOpenPdf = (fileId: string, page: number = 1) => {
    try {
      const url = fileService.getViewUrl(fileId, '0');
      const targetUrl = `${url}#page=${page}`;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      message.error(`Không thể mở tệp: ${err.message}`);
    }
  };

  // Nạp dữ liệu Study Book
  const fetchStudyBook = async (fileId: string) => {
    setLoadingStudyBook(true);
    try {
      const data = await aiService.getStudyBook(fileId);
      setStudyBookData(data);
      setSelectedAnswers({});
      setSubmittedQuiz(false);
      return data;
    } catch (err: any) {
      message.error(`Lỗi tải dữ liệu cuốn sách: ${err.message}`);
      return null;
    } finally {
      setLoadingStudyBook(false);
    }
  };

  // Nút 2: Mở Modal 02 Sơ đồ
  const handleOpenDiagram = async (fileId: string) => {
    setDiagramModalVisible(true);
    await fetchStudyBook(fileId);
  };

  // Nút 3: Mở Modal 03 Kiểm tra
  const handleOpenQuiz = async (fileId: string) => {
    setQuizModalVisible(true);
    await fetchStudyBook(fileId);
  };

  // Nộp bài kiểm tra
  const handleSelectAnswer = (qId: number, answerKey: string) => {
    if (submittedQuiz) return;
    setSelectedAnswers((prev) => ({ ...prev, [qId]: answerKey }));
  };

  const handleSubmitQuiz = () => {
    if (!studyBookData?.tab_quiz) return;
    const answeredCount = Object.keys(selectedAnswers).length;
    if (answeredCount < studyBookData.tab_quiz.length) {
      message.warning(`Đồng chí vui lòng hoàn thành tất cả ${studyBookData.tab_quiz.length} câu hỏi trước khi nộp bài.`);
      return;
    }
    setSubmittedQuiz(true);
  };

  // Tính điểm
  const calculateScore = () => {
    if (!studyBookData?.tab_quiz) return { correct: 0, total: 0 };
    let correct = 0;
    studyBookData.tab_quiz.forEach((q) => {
      if (selectedAnswers[q.id] === q.correct_answer) {
        correct += 1;
      }
    });
    return { correct, total: studyBookData.tab_quiz.length };
  };

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          1. NÚT TRÒN MỞ CHAT (FLOATING ACTION BUTTON) KÉO THẢ TỰ DO
      ───────────────────────────────────────────────────────────── */}
      <div
        onPointerDown={handlePointerDown}
        style={{
          position: 'fixed',
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          zIndex: 99999,
          touchAction: 'none',
          userSelect: 'none',
        }}
        className={`transition-shadow ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <Tooltip
          title={isDragging ? '' : 'Kéo để di chuyển • Nhấn để mở chat AI'}
          placement="left"
          open={isOpen || isDragging ? false : undefined}
        >
          <button
            type="button"
            onClick={handleToggleOpen}
            className={`
              relative w-14 h-14 rounded-full flex items-center justify-center text-white
              shadow-xl transition-transform duration-200
              ${isDragging ? 'scale-110 shadow-2xl' : 'hover:scale-105 active:scale-95'}
              bg-gradient-to-tr from-[#531dab] via-[#722ED1] to-[#9254de]
              border-2 border-white/20
              focus:outline-none focus:ring-4 focus:ring-purple-500/30
            `}
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
              boxShadow: isDark
                ? '0 10px 25px -5px rgba(114, 46, 209, 0.6), 0 0 15px rgba(146, 84, 222, 0.4)'
                : '0 10px 25px -5px rgba(114, 46, 209, 0.4)'
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
            rounded-[26px] shadow-2xl
            ${isDark ? 'bg-[#0b0c10] border border-purple-800/40 text-slate-100' : 'bg-[#fcfaff] border border-purple-200 text-slate-900'}
          `}
          style={getPopupStyle()}
        >
          {/* HEADER KHUNG CHAT */}
          <div
            className={`
              px-4 py-3.5 flex items-center justify-between border-b
              ${isDark ? 'bg-gradient-to-r from-[#1a102f] to-[#0b0c10] border-purple-900/30' : 'bg-gradient-to-r from-[#f5eeff] to-[#ffffff] border-purple-100'}
            `}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#531dab] to-[#9254de] flex items-center justify-center text-white shadow-sm flex-shrink-0">
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
                  <span>QK7 DataHub</span>
                  <span>•</span>
                  <span className="text-purple-400 font-medium">
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
                    message.success('Đã làm mới phiên hội thoại.');
                  }}
                  className="p-1.5 rounded-lg hover:bg-purple-500/10 hover:text-purple-400 transition-colors"
                >
                  <ReloadOutlined className="text-xs" />
                </button>
              </Tooltip>

              <Tooltip title={isExpanded ? 'Thu nhỏ' : 'Mở rộng'}>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 rounded-lg hover:bg-purple-500/10 hover:text-purple-400 transition-colors"
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
                          ? 'bg-[#531dab] text-white rounded-br-none'
                          : 'bg-[#722ED1] text-white rounded-br-none'
                        : isDark
                          ? 'bg-[#722ED1] text-white rounded-bl-none'
                          : 'bg-[#f3e8ff] text-[#2e1065] border border-[#d8b4fe] rounded-bl-none'
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

                  {/* CÁC NÚT BẤM HÀNH ĐỘNG BÊN TRONG BONG BÓNG AI */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-white/20 dark:border-white/15 space-y-2">
                      <div className="text-[11px] font-semibold tracking-wide uppercase opacity-90">
                        📑 Căn cứ văn bản & Hành động:
                      </div>

                      {msg.citations.map((c, cIdx) => (
                        <div key={cIdx} className="space-y-1.5">
                          {/* Nút 1: Mở PDF tại đúng trang */}
                          <button
                            onClick={() => handleOpenPdf(c.file_id, c.page)}
                            className={`
                              w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between
                              transition-all duration-200
                              ${
                                isDark
                                  ? 'bg-white/15 hover:bg-white/25 text-white'
                                  : 'bg-white hover:bg-purple-50 text-[#6b21a8] border border-[#d8b4fe] shadow-xs'
                              }
                            `}
                          >
                            <span className="flex items-center space-x-1.5 truncate mr-2">
                              <FilePdfOutlined className="text-red-400 flex-shrink-0" />
                              <span className="truncate">
                                📄 Mở {c.document_code} — Trang {c.page} (p.{c.page})
                              </span>
                            </span>
                            <span className="text-[10px] opacity-75 flex-shrink-0 font-mono">
                              [p.{c.page}]
                            </span>
                          </button>

                          {/* Nhóm 2 Nút: 02 Sơ đồ & 03 Kiểm tra */}
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => handleOpenDiagram(c.file_id)}
                              className={`
                                px-2 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center space-x-1
                                transition-all duration-200
                                ${
                                  isDark
                                    ? 'bg-white/15 hover:bg-white/25 text-white'
                                    : 'bg-white hover:bg-purple-50 text-[#6b21a8] border border-[#d8b4fe]'
                                }
                              `}
                            >
                              <ApartmentOutlined />
                              <span>🗺️ 02 Sơ đồ</span>
                            </button>

                            <button
                              onClick={() => handleOpenQuiz(c.file_id)}
                              className={`
                                px-2 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center space-x-1
                                transition-all duration-200
                                ${
                                  isDark
                                    ? 'bg-white/15 hover:bg-white/25 text-white'
                                    : 'bg-white hover:bg-purple-50 text-[#6b21a8] border border-[#d8b4fe]'
                                }
                              `}
                            >
                              <FormOutlined />
                              <span>📝 03 Kiểm tra</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bước suy luận Agentic DeepTutor (Collapse) */}
                  {msg.reasoning && (
                    <div className="mt-2.5 pt-2 border-t border-white/15 text-[11px] opacity-80">
                      <details className="cursor-pointer">
                        <summary className="font-medium hover:underline select-none">
                          🔍 Phân tích DeepTutor Agentic Grounding
                        </summary>
                        <div className="mt-1.5 space-y-1 pl-2 border-l border-white/30 text-[10.5px]">
                          {msg.reasoning.mem && (
                            <div>
                              <strong className="text-purple-200">&lt;mem&gt;:</strong>{' '}
                              {msg.reasoning.mem}
                            </div>
                          )}
                          {msg.reasoning.think && (
                            <div>
                              <strong className="text-purple-200">&lt;think&gt;:</strong>{' '}
                              {msg.reasoning.think}
                            </div>
                          )}
                          {msg.reasoning.tool_call && (
                            <div>
                              <strong className="text-purple-200">&lt;tool_call&gt;:</strong>{' '}
                              {msg.reasoning.tool_call}
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}

            {/* Trạng thái đang tải */}
            {loading && (
              <div className="flex items-center space-x-2 text-xs text-purple-400 p-2">
                <Spin size="small" />
                <span>Trợ lý đang đối chiếu văn kiện và số trang [p.X]...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* GỢI Ý CÂU HỎI NHANH */}
          {messages.length <= 2 && (
            <div className="px-3 py-1.5 flex flex-wrap gap-1.5 border-t border-purple-500/15">
              {QUICK_PROMPTS.map((prompt, pIdx) => (
                <button
                  key={pIdx}
                  onClick={() => handleSend(prompt)}
                  disabled={loading}
                  className={`
                    text-[11px] px-2.5 py-1 rounded-full transition-colors truncate max-w-full
                    ${
                      isDark
                        ? 'bg-purple-950/40 text-purple-300 hover:bg-purple-900/60 border border-purple-800/40'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
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
              ${isDark ? 'bg-[#0b0c10] border-purple-900/30' : 'bg-[#ffffff] border-purple-100'}
            `}
          >
            <div
              className={`
                flex items-center rounded-full px-3 py-1.5 border transition-all duration-200
                ${
                  isDark
                    ? 'bg-[#161922] border-purple-700/60 focus-within:border-[#722ED1] focus-within:ring-2 focus-within:ring-purple-600/30'
                    : 'bg-[#ffffff] border-purple-300 focus-within:border-[#722ED1] focus-within:ring-2 focus-within:ring-purple-400/30'
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
                      ? 'bg-[#722ED1] hover:bg-[#854eca] active:scale-95 shadow-sm'
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
          3. MODAL "02 SƠ ĐỒ" (Mermaid.js / Cấu trúc tổ chức)
      ───────────────────────────────────────────────────────────── */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400">
            <ApartmentOutlined className="text-lg" />
            <span>02 Sơ Đồ Tổ Chức & Luồng Chỉ Đạo</span>
          </div>
        }
        open={diagramModalVisible}
        onCancel={() => setDiagramModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDiagramModalVisible(false)}>
            Đóng
          </Button>
        ]}
        width={700}
        destroyOnClose
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
              message={
                <div>
                  <strong>{studyBookData.document_code}</strong> — {studyBookData.title}
                </div>
              }
              description={studyBookData.tab_diagram.description}
            />

            {/* Khối trực quan hóa sơ đồ */}
            <div
              className={`p-4 rounded-xl border ${isDark ? 'bg-slate-950 border-purple-900/40' : 'bg-slate-50 border-purple-200'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-500">
                  Mã Sơ Đồ Mermaid (Flowchart)
                </span>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(studyBookData.tab_diagram.mermaid_code);
                    message.success('Đã sao chép mã Mermaid.js vào clipboard.');
                  }}
                >
                  Sao chép mã
                </Button>
              </div>

              <pre className="p-3 rounded-lg bg-black/80 text-emerald-400 text-xs font-mono overflow-x-auto leading-relaxed">
                {studyBookData.tab_diagram.mermaid_code}
              </pre>
            </div>

            {/* Tóm tắt các phân đoạn chính */}
            {studyBookData.tab_document?.sections && (
              <div>
                <Title level={5} className="!text-sm !mb-2">
                  Chương mục & Trích dẫn số trang:
                </Title>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {studyBookData.tab_document.sections.map((sec, sIdx) => (
                    <div
                      key={sIdx}
                      className={`p-2.5 rounded-lg border text-xs ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}
                    >
                      <div className="font-semibold text-purple-600 dark:text-purple-400 mb-1">
                        {sec.title}
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mb-1">{sec.summary}</p>
                      <Button
                        size="small"
                        type="link"
                        className="!p-0 !h-auto text-xs"
                        onClick={() => handleOpenPdf(studyBookData.file_id, sec.page)}
                      >
                        📄 Mở tài liệu tại Trang {sec.page}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">Không có dữ liệu sơ đồ.</div>
        )}
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL "03 KIỂM TRA" (5 câu hỏi trắc nghiệm A/B/C/D)
      ───────────────────────────────────────────────────────────── */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400">
            <FormOutlined className="text-lg" />
            <span>03 Kiểm Tra Nhận Thức Văn Bản (Trắc Nghiệm 4 Đáp Án)</span>
          </div>
        }
        open={quizModalVisible}
        onCancel={() => setQuizModalVisible(false)}
        footer={[
          submittedQuiz ? (
            <Button
              key="retry"
              onClick={() => {
                setSubmittedQuiz(false);
                setSelectedAnswers({});
              }}
            >
              Làm Lại
            </Button>
          ) : (
            <Button
              key="submit"
              type="primary"
              className="!bg-[#722ED1]"
              onClick={handleSubmitQuiz}
              disabled={loadingStudyBook || !studyBookData?.tab_quiz}
            >
              Nộp Bài Kiểm Tra
            </Button>
          ),
          <Button key="close" onClick={() => setQuizModalVisible(false)}>
            Đóng
          </Button>
        ]}
        width={760}
        destroyOnClose
      >
        {loadingStudyBook ? (
          <div className="py-12 text-center space-y-3">
            <Spin size="large" />
            <div className="text-sm text-slate-500">Đang biên soạn bộ câu hỏi trắc nghiệm...</div>
          </div>
        ) : studyBookData?.tab_quiz ? (
          <div className="space-y-5 py-2">
            {/* Banner tổng kết điểm khi đã nộp bài */}
            {submittedQuiz && (
              <Alert
                type={calculateScore().correct >= 4 ? 'success' : 'warning'}
                showIcon
                message={
                  <span className="font-semibold text-base">
                    Kết Quả: {calculateScore().correct} / {calculateScore().total} Câu Đúng
                  </span>
                }
                description={
                  calculateScore().correct >= 4
                    ? 'Xuất sắc! Đồng chí đã nắm vững các nội dung trọng tâm và quy định bảo mật của văn bản.'
                    : 'Đồng chí cần đối chiếu lại các trang trích dẫn được giải thích bên dưới để củng cố nhận thức.'
                }
              />
            )}

            {/* Danh sách 5 câu hỏi */}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {studyBookData.tab_quiz.map((q, idx) => {
                const userChoice = selectedAnswers[q.id];
                const isCorrect = userChoice === q.correct_answer;

                return (
                  <div
                    key={q.id}
                    className={`
                      p-4 rounded-xl border transition-colors
                      ${
                        submittedQuiz
                          ? isCorrect
                            ? isDark
                              ? 'bg-emerald-950/30 border-emerald-800/50'
                              : 'bg-emerald-50/50 border-emerald-300'
                            : isDark
                              ? 'bg-rose-950/30 border-rose-800/50'
                              : 'bg-rose-50/50 border-rose-300'
                          : isDark
                            ? 'bg-slate-900/60 border-slate-800'
                            : 'bg-white border-slate-200'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="font-semibold text-sm">
                        Câu {idx + 1}: {q.question}
                      </span>
                      {submittedQuiz && (
                        <span>
                          {isCorrect ? (
                            <Tag color="success" icon={<CheckCircleOutlined />}>
                              Đúng
                            </Tag>
                          ) : (
                            <Tag color="error" icon={<CloseCircleOutlined />}>
                              Chưa đúng
                            </Tag>
                          )}
                        </span>
                      )}
                    </div>

                    {/* 4 Lựa chọn A, B, C, D */}
                    <div className="space-y-2">
                      {(['A', 'B', 'C', 'D'] as const).map((key) => {
                        const isChosen = userChoice === key;
                        const isTheCorrectOne = submittedQuiz && q.correct_answer === key;

                        return (
                          <div
                            key={key}
                            onClick={() => handleSelectAnswer(q.id, key)}
                            className={`
                              p-2.5 rounded-lg border text-xs cursor-pointer flex items-center space-x-2 transition-all
                              ${
                                isTheCorrectOne
                                  ? 'bg-emerald-500/20 border-emerald-500 font-medium text-emerald-400'
                                  : isChosen && !isCorrect && submittedQuiz
                                    ? 'bg-rose-500/20 border-rose-500 text-rose-400 line-through'
                                    : isChosen
                                      ? 'bg-purple-600/20 border-purple-500 text-purple-400 font-medium'
                                      : isDark
                                        ? 'bg-slate-950/50 border-slate-800 hover:border-purple-600/50'
                                        : 'bg-slate-50 border-slate-200 hover:border-purple-400'
                              }
                            `}
                          >
                            <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] border border-current flex-shrink-0">
                              {key}
                            </span>
                            <span className="flex-1">{q.options[key]}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Giải thích chi tiết & Trích dẫn số trang */}
                    {submittedQuiz && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <Tag color="purple">Đáp án đúng: {q.correct_answer}</Tag>
                          <Tag color="blue">{q.citation}</Tag>
                        </div>

                        <p className="text-slate-600 dark:text-slate-300">{q.explanation}</p>

                        {q.agentic_steps && (
                          <div className="p-2 rounded bg-purple-950/20 dark:bg-purple-950/40 border border-purple-800/30 text-[11px] space-y-1">
                            <div>
                              <strong className="text-purple-400">&lt;mem&gt;:</strong>{' '}
                              {q.agentic_steps.mem}
                            </div>
                            <div>
                              <strong className="text-purple-400">&lt;think&gt;:</strong>{' '}
                              {q.agentic_steps.think}
                            </div>
                            <div>
                              <strong className="text-purple-400">&lt;tool_call&gt;:</strong>{' '}
                              {q.agentic_steps.tool_call}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">Không thể tải đề kiểm tra.</div>
        )}
      </Modal>
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
        <strong key={index} className="font-semibold text-purple-300 dark:text-purple-200">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (/^\[p\.\d+\]$/.test(part)) {
      return (
        <span
          key={index}
          className="inline-block px-1.5 py-0.2 mx-0.5 rounded bg-purple-900/40 text-purple-300 font-mono text-[11px] border border-purple-500/30"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

export default AIChatWidget;
