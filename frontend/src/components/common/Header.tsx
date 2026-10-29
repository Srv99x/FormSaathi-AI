import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, Globe, Layers, FileText } from 'lucide-react';
import { api } from '../../services/api';

interface HeaderProps {
  locale?: 'en-IN' | 'hi-IN';
  onToggleLocale?: () => void;
  formTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  locale = 'en-IN',
  onToggleLocale,
  formTitle,
}) => {
  const location = useLocation();
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  useEffect(() => {
    let mounted = true;
    api.getHealth().then((health) => {
      if (mounted) {
        setBackendStatus(health.status === 'ok' ? 'online' : 'offline');
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const isBuilder = location.pathname === '/' || location.pathname.startsWith('/create');
  const isFiller = location.pathname.startsWith('/fill');

  return (
    <header className="fs-header" role="banner">
      <div className="fs-header-left">
        <Link to="/" className="fs-brand-link" aria-label="FormSaathi Home">
          <div className="fs-brand-badge">
            <Sparkles size={18} className="fs-brand-sparkle" />
          </div>
          <div className="fs-brand-titles">
            <span className="fs-brand-name">FormSaathi Studio</span>
            <span className="fs-brand-tagline">
              {locale === 'hi-IN' ? 'आवाज़-सक्षम स्मार्ट फॉर्म' : 'Voice-Assisted Forms'}
            </span>
          </div>
        </Link>

        {formTitle && (
          <div className="fs-header-form-title">
            <span className="fs-title-divider">/</span>
            <span className="fs-active-title" title={formTitle}>
              {formTitle}
            </span>
          </div>
        )}
      </div>

      <nav className="fs-header-nav" aria-label="Main Navigation">
        <Link
          to="/create"
          className={`fs-nav-tab ${isBuilder ? 'is-active' : ''}`}
        >
          <Layers size={16} />
          <span>Form Builder</span>
        </Link>

        <Link
          to="/fill/student_registration_v1"
          className={`fs-nav-tab ${isFiller ? 'is-active' : ''}`}
        >
          <FileText size={16} />
          <span>Fill Registration</span>
        </Link>
      </nav>

      <div className="fs-header-right">
        {/* Backend health pill */}
        <div
          className={`fs-status-pill ${backendStatus}`}
          title={`Backend status: ${backendStatus}`}
        >
          <span className="fs-status-dot" />
          <span className="fs-status-text">
            {backendStatus === 'online' ? 'API Connected' : 'Local Mode'}
          </span>
        </div>

        {/* Locale toggle button */}
        {onToggleLocale && (
          <button
            type="button"
            className="fs-lang-toggle"
            onClick={onToggleLocale}
            aria-label={locale === 'en-IN' ? 'Switch to Hindi' : 'अंग्रेजी में बदलें'}
          >
            <Globe size={15} />
            <span>{locale === 'en-IN' ? 'हिन्दी' : 'English'}</span>
          </button>
        )}
      </div>
    </header>
  );
};
