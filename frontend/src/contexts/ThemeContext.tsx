import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light';

export interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: (event?: React.MouseEvent) => void;
  setTheme: (theme: Theme) => void;
}

const THEME_STORAGE_KEY = 'qk7_theme';

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch (e) {
      // ignore
    }
    // Default to dark for QK7 DataHub
    return document.documentElement.classList.contains('light') ? 'light' : 'dark';
  });

  // Apply theme to DOM (html, body, data-theme, color-scheme)
  const applyThemeToDOM = useCallback((newTheme: Theme) => {
    const root = document.documentElement;
    const body = document.body;

    if (newTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
      if (body) {
        body.classList.add('dark');
        body.classList.remove('light');
      }
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
      if (body) {
        body.classList.remove('dark');
        body.classList.add('light');
      }
    }
  }, []);

  // Update state, storage, and DOM
  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      } catch (e) {
        // ignore
      }
      applyThemeToDOM(newTheme);
    },
    [applyThemeToDOM]
  );

  // Sync on mount and listen to multi-tab storage updates
  useEffect(() => {
    applyThemeToDOM(theme);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
        setThemeState(e.newValue);
        applyThemeToDOM(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [theme, applyThemeToDOM]);

  // <!-- Lucian UX/UI Prompt #219 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#219 -->
  // Toggle with Circular-reveal animated transition
  const toggleTheme = useCallback(
    (event?: React.MouseEvent) => {
      const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';

      // Check View Transitions API support
      const hasViewTransitions =
        typeof document !== 'undefined' &&
        'startViewTransition' in document &&
        typeof (document as any).startViewTransition === 'function' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (hasViewTransitions) {
        const root = document.documentElement;
        // Tọa độ tâm vòng tròn (--cx, --cy) tính toán chính xác từ getBoundingClientRect() của nút bấm
        const cxVar = root.style.getPropertyValue('--cx');
        const cyVar = root.style.getPropertyValue('--cy');
        const x = cxVar ? parseFloat(cxVar) : (event?.clientX ?? window.innerWidth - 60);
        const y = cyVar ? parseFloat(cyVar) : (event?.clientY ?? 32);

        try {
          const transition = (document as any).startViewTransition(() => {
            setTheme(nextTheme);
          });

          if (transition && transition.ready) {
            transition.ready
              .then(() => {
                // Hiệu ứng lan tỏa hình tròn (clip-path: circle) từ 0px ra 150vmax phủ kín toàn màn hình
                document.documentElement.animate(
                  {
                    clipPath: [
                      `circle(0px at ${x}px ${y}px)`,
                      `circle(150vmax at ${x}px ${y}px)`
                    ]
                  },
                  {
                    duration: 700,
                    easing: 'cubic-bezier(.65, 0, .35, 1)',
                    pseudoElement: '::view-transition-new(root)'
                  }
                );
              })
              .catch(() => {
                setTheme(nextTheme);
              });
          }
          return;
        } catch (e) {
          // Fall through to standard transition
        }
      }

      // Smooth CSS transition fallback
      document.documentElement.classList.add('theme-transition');
      setTheme(nextTheme);
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transition');
      }, 400);
    },
    [theme, setTheme]
  );

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        toggleTheme,
        setTheme
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Resilient fallback when component is rendered without ThemeProvider
    const isDark =
      typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true;
    return {
      theme: isDark ? 'dark' : 'light',
      isDark,
      toggleTheme: () => {
        const next = isDark ? 'light' : 'dark';
        if (typeof document !== 'undefined') {
          if (next === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
          } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
          }
        }
        try {
          localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch (e) {}
      },
      setTheme: (newTheme) => {
        if (typeof document !== 'undefined') {
          if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
          } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
          }
        }
        try {
          localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        } catch (e) {}
      }
    };
  }
  return context;
};
