import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './i18n/index.js';
import './index.css';
import { App } from './App.js';
import { AuthProvider } from './auth/AuthContext.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { ThemeProvider } from './theme/ThemeContext.js';

const container = document.getElementById('root');
if (!container) 
  throw new Error('#root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        {/* Inside ThemeProvider so the fallback is painted in the room the visitor chose, and outside AuthProvider so a failure in the session
        plumbing is caught instead of taking the boundary down with it. */}
        <ErrorBoundary>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
