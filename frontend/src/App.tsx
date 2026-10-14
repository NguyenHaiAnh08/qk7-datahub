import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { RouterProvider } from './routes/RouterProvider';
import './index.css';

/**
 * Root Application Component
 * Sets up global context providers (Theme, Auth) and BrowserRouter.
 * Route definitions are fully delegated to RouterProvider (auto-discovered routes).
 */
export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
