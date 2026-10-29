import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, ExternalLink, Code, QrCode, Share2 } from 'lucide-react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

export interface PublishModalProps {
  isOpen: boolean;
  formId: string;
  formTitle: string;
  onClose: () => void;
}

export const PublishModal: React.FC<PublishModalProps> = ({
  isOpen,
  formId,
  formTitle,
  onClose,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const fillUrl = `${origin}/fill/${encodeURIComponent(formId)}`;
  const embedCode = `<iframe src="${fillUrl}" width="100%" height="800" frameborder="0" style="border:none;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);" title="${formTitle}"></iframe>`;

  useEffect(() => {
    if (isOpen && fillUrl) {
      QRCode.toDataURL(fillUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#1a73e8',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.warn('QR code generation error', err));
    }
  }, [isOpen, fillUrl]);

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
      await navigator.clipboard.writeText(embedCode);
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Publish & Share Form" maxWidth="md">
      <div className="fs-publish-modal-body">
        <div className="fs-publish-success-banner">
          <div className="fs-publish-icon-wrap">
            <Share2 size={24} className="fs-share-icon" />
          </div>
          <div>
            <h4 className="fs-publish-banner-title">Your form is live and voice-ready!</h4>
            <p className="fs-publish-banner-sub">
              Respondents can complete this form manually or hands-free via real-time voice call.
            </p>
          </div>
        </div>

        {/* 1. Direct Shareable Link */}
        <div className="fs-publish-block">
          <label className="fs-input-label" htmlFor="shareable-link">
            Shareable Form Link:
          </label>
          <div className="fs-copy-input-row">
            <input
              id="shareable-link"
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
              {copiedLink ? 'Copied!' : 'Copy Link'}
            </Button>
            <a
              href={fillUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="fs-btn fs-btn-outline fs-btn-md fs-open-link"
              title="Open Form in new tab"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        </div>

        {/* 2. QR Code Generator Preview */}
        <div className="fs-publish-block">
          <div className="fs-qr-preview-box">
            <div className="fs-qr-image-wrap">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR code for ${formTitle}`}
                  className="fs-qr-image"
                />
              ) : (
                <div className="fs-qr-placeholder">
                  <QrCode size={48} />
                </div>
              )}
            </div>
            <div className="fs-qr-info">
              <h5>Official QR Code</h5>
              <p>
                Print or display this QR code on university noticeboards, reception counters, or
                brochures for instant camera-scan mobile form filling.
              </p>
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`qr_${formId}.png`}
                  className="fs-download-qr-link"
                >
                  Download QR Code (PNG)
                </a>
              )}
            </div>
          </div>
        </div>

        {/* 3. Embed Snippet */}
        <div className="fs-publish-block">
          <label className="fs-input-label" htmlFor="embed-code">
            Embed HTML Code (iframe):
          </label>
          <div className="fs-embed-code-wrap">
            <textarea
              id="embed-code"
              readOnly
              value={embedCode}
              rows={3}
              className="fs-input-field fs-code-textarea"
            />
            <Button
              variant={copiedEmbed ? 'primary' : 'outline'}
              size="sm"
              icon={copiedEmbed ? <Check size={14} /> : <Code size={14} />}
              onClick={handleCopyEmbed}
              className="fs-copy-embed-btn"
            >
              {copiedEmbed ? 'Snippet Copied' : 'Copy Embed Snippet'}
            </Button>
          </div>
        </div>

        <div className="fs-publish-footer">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};

