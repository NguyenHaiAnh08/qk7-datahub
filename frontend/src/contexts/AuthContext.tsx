import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types/user';
import { authService } from '../services/authService';
import { ROUTE_PATHS } from '../routes/routePaths';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isManager: boolean;
  isGuest: boolean;
  roles: string[];
  role_names: string[];
  hasRole: (roleOrName: string) => boolean;
  login: (userId: string, password: string) => Promise<User>;
  logout: () => void;
  continueAsGuest: () => void;
  saveUserSession: (user: User) => void;
  refreshProfile: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const isUserAdmin = (user: User | null): boolean => {
  if (!user || user.user_id === 'GUEST') return false;
  const roles = user.roles || [];
  const roleNames = user.role_names || [];
  return (
    roles.includes('ROL-01') ||
    roles.some((r) => r.toLowerCase() === 'admin') ||
    roleNames.some((name) => {
      const lower = name.toLowerCase();
      return lower.includes('admin') || lower.includes('quản trị');
    })
  );
};

export const isUserStaff = (user: User | null): boolean => {
  if (!user || user.user_id === 'GUEST') return false;
  const roles = user.roles || [];
  const roleNames = user.role_names || [];
  return (
    roles.includes('ROL-04') ||
    roles.includes('ROL-07') ||
    roles.some((r) => r.toLowerCase() === 'staff') ||
    roleNames.some((name) => {
      const lower = name.toLowerCase();
      return lower.includes('thư ký') || lower.includes('văn thư') || lower.includes('staff');
    })
  );
};

export const isUserManager = (user: User | null): boolean => {
  if (!user || user.user_id === 'GUEST') return false;
  const roles = user.roles || [];
  const roleNames = user.role_names || [];
  return (
    roles.includes('ROL-02') ||
    roles.includes('ROL-03') ||
    roleNames.some((name) => {
      const lower = name.toLowerCase();
      return lower.includes('chỉ huy') || lower.includes('thủ trưởng') || lower.includes('trưởng phòng');
    })
  );
};

export const getDestinationByRole = (user: User | null): string => {
  if (!user || user.user_id === 'GUEST') {
    return ROUTE_PATHS.PORTAL;
  }
  // 1. Chỉ tài khoản có Role Admin mới được vào trang Quản trị Admin
  if (isUserAdmin(user)) {
    return ROUTE_PATHS.ADMIN;
  }
  // 2. Tài khoản Thư ký / Văn thư phụ trách bàn làm việc
  if (isUserStaff(user)) {
    return ROUTE_PATHS.DESK;
  }
  // 3. Các role khác (Chỉ huy, Thủ trưởng, Sĩ quan...) vào Cổng tra cứu Portal
  return ROUTE_PATHS.PORTAL;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => authService.getCurrentSession());
  const navigate = useNavigate();

  const saveUserSession = useCallback((userData: User) => {
    authService.saveSession(userData);
    setUser(userData);
  }, []);

  const refreshProfile = useCallback(async (): Promise<User | null> => {
    const current = authService.getCurrentSession();
    if (!current || current.user_id === 'GUEST') return null;

    try {
      const freshUser = await authService.getMe();
      if (freshUser && freshUser.user_id) {
        saveUserSession(freshUser);
        return freshUser;
      }
    } catch (err) {
      console.warn('[AuthProvider] Không thể làm mới hồ sơ từ /api/auth/me:', err);
    }
    return current;
  }, [saveUserSession]);

  useEffect(() => {
    const session = authService.getCurrentSession();
    setUser(session);
    if (session && session.user_id !== 'GUEST') {
      refreshProfile().catch(() => {});
    }
  }, [refreshProfile]);

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
    navigate(ROUTE_PATHS.LOGIN);
  }, [navigate]);

  const continueAsGuest = useCallback(() => {
    authService.clearSession();
    const guestUser: User = {
      user_id: 'GUEST',
      full_name: 'Khách',
      clearance_level_id: 1,
      clearance_name: 'Công khai',
    };
    setUser(guestUser);
    navigate(ROUTE_PATHS.PORTAL);
  }, [navigate]);

  const isAuthenticated = !!user && user.user_id !== 'GUEST';
  const isAdmin = isUserAdmin(user);
  const isManager = isUserManager(user);
  const isStaff = isUserStaff(user);
  const isGuest = !user || user.user_id === 'GUEST';
  const roles = user?.roles || [];
  const role_names = user?.role_names || [];

  const hasRole = useCallback((roleOrName: string) => {
    if (!user) return false;
    const lower = roleOrName.toLowerCase();
    const hasCode = (user.roles || []).some(r => r.toLowerCase() === lower);
    const hasName = (user.role_names || []).some(n => n.toLowerCase() === lower);
    return hasCode || hasName;
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isAdmin,
        isStaff,
        isManager,
        isGuest,
        roles,
        role_names,
        hasRole,
        login,
        logout,
        continueAsGuest,
        saveUserSession,
        refreshProfile,
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
      isAdmin: isUserAdmin(current),
      isStaff: isUserStaff(current),
      isManager: isUserManager(current),
      isGuest: current.user_id === 'GUEST',
      roles: current.roles || [],
      role_names: current.role_names || [],
      hasRole: (roleOrName: string) => {
        const lower = roleOrName.toLowerCase();
        return (
          (current.roles || []).some(r => r.toLowerCase() === lower) ||
          (current.role_names || []).some(n => n.toLowerCase() === lower)
        );
      },
      login: async (u, p) => (await authService.login(u, p)).user,
      logout: () => {
        authService.clearSession();
        window.location.href = ROUTE_PATHS.LOGIN;
      },
      continueAsGuest: () => {
        authService.clearSession();
        window.location.href = ROUTE_PATHS.PORTAL;
      },
      saveUserSession: authService.saveSession,
      refreshProfile: async () => current,
    };
  }
  return context;
}

export const useAuth = useAuthContext;

