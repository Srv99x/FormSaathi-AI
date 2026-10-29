import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Home } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Header } from '../components/common/Header';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="fs-filler-page-wrapper">
      <Header />
      <main className="fs-filler-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="fs-card" style={{ maxWidth: '480px', textAlign: 'center', padding: '36px 24px' }}>
          <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', marginBottom: '16px' }}>
            <AlertCircle size={40} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
            Page Not Found
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9375rem', marginBottom: '24px', lineHeight: 1.5 }}>
            The requested form or URL could not be found. Please check the address or return to the Form Builder.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link to="/create">
              <Button variant="primary" icon={<Home size={16} />}>
                Go to Form Builder
              </Button>
            </Link>
            <Link to="/fill/student_registration_v1">
              <Button variant="outline">
                Open Registration
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};
