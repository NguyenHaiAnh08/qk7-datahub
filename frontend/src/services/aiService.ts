/**
 * aiService.ts - Tầng Dịch Vụ Mạng Kết Nối Trợ Lý AI Tác Chiến & Văn Thư QK7
 * Gọi API Gateway Express (:8000) -> Proxy sang AI_BOXCHAT (:8001) với Smart SQL Fallback
 */

import { http } from './http';

export interface AICitation {
  file_id: string;
  document_code: string;
  title: string;
  page: number;
  security_level_name: string;
  snippet: string;
  requires_biometric?: boolean;
  security_level_id?: number;
}

export interface AIReasoning {
  mem?: string;
  think?: string;
  tool_call?: string;
}

export interface AIChatResponse {
  answer: string;
  citations: AICitation[];
  reasoning?: AIReasoning;
  think?: string;
  requires_biometric?: boolean;
}

export interface AIQuizQuestion {
  id: number;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct_answer: 'A' | 'B' | 'C' | 'D';
  citation: string;
  explanation: string;
  agentic_steps?: {
    mem: string;
    think: string;
    tool_call: string;
  };
}

export interface AIStudyBookResponse {
  file_id: string;
  document_code: string;
  title: string;
  total_pages: number;
  tab_document: {
    overview: string;
    document_code: string;
    title: string;
    total_sections: number;
    sections: Array<{
      section_id: string;
      page: number;
      title: string;
      summary: string;
      key_takeaways: string[];
    }>;
  };
  tab_diagram: {
    chart_type: string;
    mermaid_code: string;
    description: string;
  };
  tab_quiz: AIQuizQuestion[];
}

export interface AIHealthStatus {
  status: string;
  service: string;
  port?: number;
  total_chunks_indexed?: number;
  total_documents_in_db?: number;
  ollama_connected?: boolean;
  message?: string;
  gateway_mode?: string;
}

export const aiService = {
  /**
   * Gửi câu hỏi tác chiến tới Trợ lý AI (Pre-filtering bảo mật theo X-Clearance & Khóa Biometric Cấp 3-5)
   */
  async chat(params: {
    query: string;
    file_id?: string;
    history?: Array<{ role: string; content: string }>;
    fingerprint_token?: string;
  }): Promise<AIChatResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // P0 SECURITY: CHỈ gửi X-Fingerprint-Token khi được truyền tường minh (explicit auto-retry sau khi quét vân tay)
    // TUYỆT ĐỐI KHÔNG tự động lấy từ sessionStorage gửi kèm câu hỏi mới
    const effectiveToken = params.fingerprint_token;
    if (effectiveToken) {
      headers['X-Fingerprint-Token'] = effectiveToken;
    }
    return http<AIChatResponse>('/api/ai/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: params.query,
        file_id: params.file_id,
        history: params.history,
        fingerprint_token: effectiveToken,
      }),
      skipErrorNotification: false,
    });
  },

  /**
   * Tạo gói học tập "Cuốn sách riêng" 3 Tab (01 Tài liệu, 02 Sơ đồ, 03 Kiểm tra)
   */
  async getStudyBook(fileId: string): Promise<AIStudyBookResponse> {
    return http<AIStudyBookResponse>(`/api/ai/study-book/${encodeURIComponent(fileId)}`, {
      method: 'GET',
      skipErrorNotification: false,
    });
  },

  /**
   * Kiểm tra tình trạng kết nối AI BoxChat & Vector DB
   */
  async checkHealth(): Promise<AIHealthStatus> {
    return http<AIHealthStatus>('/api/ai/health', {
      method: 'GET',
      skipErrorNotification: true,
      silent: true,
    }).catch(() => ({
      status: 'offline',
      service: 'AI Gateway Fallback',
      message: 'Đang kết nối lại máy chủ AI...',
    }));
  },

  /**
   * Đồng bộ toàn bộ tài liệu từ CSDL vào kho Vector
   */
  async syncAll(): Promise<{ success: boolean; total_documents?: number }> {
    return http<{ success: boolean; total_documents?: number }>('/api/ai/sync-all', {
      method: 'POST',
    });
  },
};

export default aiService;
