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
    </BrowserRouter>
  );
};

export default App;
