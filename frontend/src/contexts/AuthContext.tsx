import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../types/user';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isManager: boolean;
  isGuest: boolean;
  login: (userId: string, password: string) => Promise<User>;
  logout: () => void;
  continueAsGuest: () => void;
  saveUserSession: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => authService.getCurrentSession());

  useEffect(() => {
    setUser(authService.getCurrentSession());
  }, []);

  const saveUserSession = useCallback((userData: User) => {
    authService.saveSession(userData);
    setUser(userData);
  }, []);

  const login = useCallback(async (userId: string, password: string) => {
    const res = await authService.login(userId, password);
    if (res.success && res.user) {
      saveUserSession(res.user);
      return res.user;
    }
    throw new Error('Đăng nhập thất bại');
  }, [saveUserSession]);

  const logout = useCallback(() => {
    authService.clearSession();
    setUser(null);
    window.location.href = 'login.html';
  }, []);

  const continueAsGuest = useCallback(() => {
    authService.clearSession();
    const guestUser: User = {
      user_id: 'GUEST',
      full_name: 'Khách',
      clearance_level_id: 1,
      clearance_name: 'Công khai',
    };
    setUser(guestUser);
    window.location.href = 'portal.html';
  }, []);

  const isAuthenticated = !!user && user.user_id !== 'GUEST';
  const isAdmin = !!user && user.clearance_level_id >= 4;
  const isManager = !!user && user.clearance_level_id === 4;
  const isStaff = !!user && user.clearance_level_id === 3;
  const isGuest = !user || user.user_id === 'GUEST';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isAdmin,
        isStaff,
        isManager,
        isGuest,
        login,
        logout,
        continueAsGuest,
        saveUserSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    // Fallback if not inside provider
    const current = authService.getCurrentSession();
    return {
      user: current,
      isAuthenticated: current.user_id !== 'GUEST',
      isAdmin: current.clearance_level_id >= 4,
      isStaff: current.clearance_level_id === 3,
      isManager: current.clearance_level_id === 4,
      isGuest: current.user_id === 'GUEST',
      login: async (u, p) => (await authService.login(u, p)).user,
      logout: () => {
        authService.clearSession();
        window.location.href = 'login.html';
      },
      continueAsGuest: () => {
        authService.clearSession();
        window.location.href = 'portal.html';
      },
      saveUserSession: authService.saveSession,
    };
  }
  return context;
}
