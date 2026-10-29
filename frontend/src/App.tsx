import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { FormBuilderPage } from './pages/FormBuilderPage';
import { FormFillerPage } from './pages/FormFillerPage';
import { FormSharePage } from './pages/FormSharePage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Page 1: Form Builder Dashboard (Google Forms style) */}
        <Route path="/" element={<FormBuilderPage />} />
        <Route path="/create" element={<FormBuilderPage />} />

        {/* Page 2: Public Respondent Form Filling with Realtime Voice Assistant */}
        <Route path="/fill/:formId" element={<FormFillerPage />} />

        {/* Page 3: Share landing page with direct link, copy button & QR code preview */}
        <Route path="/share/:formId" element={<FormSharePage />} />

        {/* 404 Not Found fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
