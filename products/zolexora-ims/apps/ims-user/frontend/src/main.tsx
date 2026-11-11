import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ZolexoraAuthProvider } from '@zolexora/auth-client/react';
import App from './app';
import { AuthProvider } from './lib/auth-context';
import { AUTH_SERVICE_PUBLIC_URL, IMS_PRODUCT } from './lib/runtime';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ZolexoraAuthProvider authUrl={AUTH_SERVICE_PUBLIC_URL()} product={IMS_PRODUCT}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ZolexoraAuthProvider>
  </React.StrictMode>
);
