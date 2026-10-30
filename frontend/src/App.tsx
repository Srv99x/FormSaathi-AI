import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const FormFillerPage = lazy(() => import('./pages/FormFillerPage').then((m) => ({ default: m.FormFillerPage })));
const FormBuilderPage = lazy(() => import('./pages/FormBuilderPage').then((m) => ({ default: m.FormBuilderPage })));
const FormSharePage = lazy(() => import('./pages/FormSharePage').then((m) => ({ default: m.FormSharePage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const RouteLoadingFallback = () => (
  <div className="fs-loading-screen" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div className="fs-loading-spinner" />
  </div>
);

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          {/* Root URL opens the current Form directly */}
          <Route path="/" element={<FormFillerPage />} />
          <Route path="/fill/:formId" element={<FormFillerPage />} />
          <Route path="/form/:formId" element={<FormFillerPage />} />

          {/* Form Builder Dashboard */}
          <Route path="/create" element={<FormBuilderPage />} />
          <Route path="/builder" element={<FormBuilderPage />} />

          {/* Share landing page with direct link, copy button & QR code preview */}
          <Route path="/share/:formId" element={<FormSharePage />} />

          {/* 404 Not Found fallback */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
