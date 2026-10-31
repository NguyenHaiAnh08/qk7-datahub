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
  permissions: string[];
  hasRole: (roleOrName: string) => boolean;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
  hasAllPermissions: (codes: string[]) => boolean;
  login: (userId: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
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
    roleNames.some((n) => n.toLowerCase().includes('admin') || n.toLowerCase().includes('quản trị'))
  );
};

export const isUserStaff = (user: User | null): boolean => {
  if (!user || user.user_id === 'GUEST') return false;
  const roles = user.roles || [];
  const roleNames = user.role_names || [];
  return (
    roles.includes('ROL-04') || roles.includes('ROL-07') ||
    roleNames.some((n) => {
      const l = n.toLowerCase();
      return l.includes('thư ký') || l.includes('văn thư') || l.includes('staff');
    })
  );
};

export const isUserManager = (user: User | null): boolean => {
  if (!user || user.user_id === 'GUEST') return false;
  const roles = user.roles || [];
  const roleNames = user.role_names || [];
  return (
    roles.includes('ROL-02') || roles.includes('ROL-03') ||
    roleNames.some((n) => {
      const l = n.toLowerCase();
      return l.includes('chỉ huy') || l.includes('thủ trưởng') || l.includes('trưởng phòng');
    })
  );
};

export const getDestinationByRole = (user: User | null): string => {
  if (!user || user.user_id === 'GUEST') return ROUTE_PATHS.PORTAL;
  if (isUserAdmin(user)) return ROUTE_PATHS.ADMIN;
  if (isUserStaff(user)) return ROUTE_PATHS.DESK;
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
      const fresh = await authService.getMe();
      if (fresh && fresh.user_id) {
        saveUserSession(fresh);
        return fresh;
      }
    } catch (err) {
      console.warn('[AuthProvider] refreshProfile:', err);
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

  useEffect(() => {
    const handleExpired = () => {
      authService.clearSession();
      setUser(null);
      navigate(ROUTE_PATHS.LOGIN, { replace: true });
    };
    window.addEventListener('qk7:session-expired', handleExpired);
    return () => window.removeEventListener('qk7:session-expired', handleExpired);
  }, [navigate]);

  const login = useCallback(async (userId: string, password: string) => {
    const res = await authService.login(userId, password);
    if (res.success && res.user) {
      saveUserSession(res.user);
      return res.user;
    }
    throw new Error('Đăng nhập thất bại');
  }, [saveUserSession]);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    navigate(ROUTE_PATHS.LOGIN);

    if (typeof window !== 'undefined') {
    try {
      Object.keys(sessionStorage)
        .filter(k => k.startsWith('qk7_fp_token'))
        .forEach(k => sessionStorage.removeItem(k));
    } catch (e) {}
  }
  }, [navigate]);

  const continueAsGuest = useCallback(() => {
    authService.clearSession();
    const guest: User = {
      user_id: 'GUEST',
      full_name: 'Đại biểu',
      clearance_level_id: 1,
      clearance_name: 'Công khai',
      permissions: [],
    };
    setUser(guest);
    navigate(ROUTE_PATHS.PORTAL);
  }, [navigate]);

  const isAuthenticated = !!user && user.user_id !== 'GUEST';
  const isAdmin = isUserAdmin(user);
  const isManager = isUserManager(user);
  const isStaff = isUserStaff(user);
  const isGuest = !user || user.user_id === 'GUEST';
  const roles = user?.roles || [];
  const role_names = user?.role_names || [];
  const permissions = user?.permissions || [];
  const isAdminBypass = roles.includes('ROL-01');

  const hasRole = useCallback((roleOrName: string) => {
    if (!user) return false;
    const l = roleOrName.toLowerCase();
    return (
      (user.roles || []).some((r) => r.toLowerCase() === l) ||
      (user.role_names || []).some((n) => n.toLowerCase() === l)
    );
  }, [user]);

  const hasPermission = useCallback((code: string) => {
    if (!user) return false;
    if (isAdminBypass) return true;        // ⭐ Admin bypass
    return (user.permissions || []).includes(code);
  }, [user, isAdminBypass]);

  const hasAnyPermission = useCallback((codes: string[]) => {
    if (!user) return false;
    if (isAdminBypass) return true;
    return codes.some((c) => (user.permissions || []).includes(c));
  }, [user, isAdminBypass]);

  const hasAllPermissions = useCallback((codes: string[]) => {
    if (!user) return false;
    if (isAdminBypass) return true;
    return codes.every((c) => (user.permissions || []).includes(c));
  }, [user, isAdminBypass]);

  return (
    <AuthContext.Provider
      value={{
        user, isAuthenticated, isAdmin, isStaff, isManager, isGuest,
        roles, role_names, permissions,
        hasRole, hasPermission, hasAnyPermission, hasAllPermissions,
        login, logout, continueAsGuest, saveUserSession, refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext phải được dùng trong AuthProvider');
  return ctx;
}

export const useAuth = useAuthContext;