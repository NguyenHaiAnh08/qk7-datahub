import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface AIChatContextType {
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  aiStatus: 'online' | 'fallback' | 'checking';
  setAiStatus: (status: 'online' | 'fallback' | 'checking') => void;
}

const AIChatContext = createContext<AIChatContextType | undefined>(undefined);

export const AIChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<'online' | 'fallback' | 'checking'>('checking');

  const openChat = useCallback(() => setIsChatOpen(true), []);
  const closeChat = useCallback(() => setIsChatOpen(false), []);
  const toggleChat = useCallback(() => setIsChatOpen((prev) => !prev), []);

  return (
    <AIChatContext.Provider
      value={{
        isChatOpen,
        setIsChatOpen,
        openChat,
        closeChat,
        toggleChat,
        aiStatus,
        setAiStatus,
      }}
    >
      {children}
    </AIChatContext.Provider>
  );
};

export const useAIChat = (): AIChatContextType => {
  const ctx = useContext(AIChatContext);
  if (!ctx) {
    throw new Error('useAIChat must be used within an AIChatProvider');
  }
  return ctx;
};
