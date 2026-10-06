import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import { initSentry } from './lib/sentry.js';
import './styles/index.css';

// No-op without VITE_SENTRY_DSN set at build time — see lib/sentry.js.
initSentry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
