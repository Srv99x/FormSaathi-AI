import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { Copy, Check, ArrowRight, QrCode, Code } from 'lucide-react';
import { Header } from '../components/common/Header';
import { Button } from '../components/common/Button';
import { resolveFormSchema } from '../services/schemaMapper';

export const FormSharePage: React.FC = () => {
  const { formId = 'student_registration_v1' } = useParams<{ formId: string }>();
  const navigate = useNavigate();

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const form = resolveFormSchema(formId);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const fillUrl = `${origin}/fill/${encodeURIComponent(formId)}`;
  const embedSnippet = `<iframe src="${fillUrl}" width="100%" height="800" frameborder="0" style="border:none;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);" title="${form.title}"></iframe>`;

  useEffect(() => {
    if (fillUrl) {
      QRCode.toDataURL(fillUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#1a73e8',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.warn('QR error', err));
    }
  }, [fillUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fillUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedSnippet);
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="fs-share-page-wrapper">
      <Header formTitle={form.title} />

      <main className="fs-share-main" role="main">
        <div className="fs-share-card fs-card">
          <div
            className="fs-builder-banner-strip"
            style={{ backgroundColor: form.bannerColor || '#1a73e8' }}
          />

          <div className="fs-share-card-header">
            <span className="fs-share-badge">Form Published & Live</span>
            <h1 className="fs-share-title">{form.title}</h1>
            <p className="fs-share-desc">{form.description}</p>
          </div>

          <div className="fs-share-grid">
            {/* Left Column: Link & Actions */}
            <div className="fs-share-left">
              <div className="fs-share-section">
                <label className="fs-input-label" htmlFor="share-direct-link">
                  Direct Respondent URL:
                </label>
                <div className="fs-copy-input-row">
                  <input
                    id="share-direct-link"
                    type="text"
                    readOnly
                    value={fillUrl}
                    className="fs-input-field fs-readonly-link"
                  />
                  <Button
                    variant={copiedLink ? 'primary' : 'secondary'}
                    icon={copiedLink ? <Check size={16} /> : <Copy size={16} />}
                    onClick={handleCopyLink}
                  >
                    {copiedLink ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              <div className="fs-share-cta-box">
                <Button
                  variant="primary"
                  size="lg"
                  icon={<ArrowRight size={18} />}
                  onClick={() => navigate(`/fill/${encodeURIComponent(formId)}`)}
                >
                  Open & Fill Form Now
                </Button>
                <Link to="/create" className="fs-share-edit-link">
                  Return to Form Builder
                </Link>
              </div>

              <div className="fs-share-section">
                <label className="fs-input-label" htmlFor="share-embed">
                  Embed in Portal / Website (iframe):
                </label>
                <textarea
                  id="share-embed"
                  readOnly
                  rows={3}
                  value={embedSnippet}
                  className="fs-input-field fs-code-textarea"
                />
                <Button
                  variant={copiedEmbed ? 'primary' : 'outline'}
                  size="sm"
                  icon={copiedEmbed ? <Check size={14} /> : <Code size={14} />}
                  onClick={handleCopyEmbed}
                  style={{ marginTop: '8px' }}
                >
                  {copiedEmbed ? 'Embed Code Copied' : 'Copy Embed Code'}
                </Button>
              </div>
            </div>

            {/* Right Column: QR Code Preview */}
            <div className="fs-share-right">
              <div className="fs-share-qr-card">
                <h4 className="fs-qr-heading">Scan to Fill on Mobile</h4>
                <div className="fs-qr-image-container">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR code for ${form.title}`}
                      className="fs-qr-main-img"
                    />
                  ) : (
                    <div className="fs-qr-loading-placeholder">
                      <QrCode size={56} />
                    </div>
                  )}
                </div>
                <p className="fs-qr-caption">
                  Point your phone's camera at this code to open the bilingual voice-assisted form
                  instantly.
                </p>
                {qrDataUrl && (
                  <a
                    href={qrDataUrl}
                    download={`qrcode_${formId}.png`}
                    className="fs-download-btn-link"
                  >
                    Download High-Res QR (PNG)
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
