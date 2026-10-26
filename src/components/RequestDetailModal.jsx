import { useEffect } from 'react';
import { X } from 'lucide-react';
import RequestDetail from '../pages/RequestDetail';
import './RequestDetailModal.css';

export default function RequestDetailModal({ isOpen, requestId, onClose, onUpdated }) {
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !requestId) return null;

  return (
    <div className="request-detail-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="request-detail-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-detail-modal-title"
      >
        <div className="request-detail-modal-topbar">
          <div className="request-detail-modal-title" id="request-detail-modal-title">
            <span>Detalle de Solicitud</span>
            <span className="request-detail-modal-badge">Vista Rápida</span>
          </div>
          <button
            type="button"
            className="request-detail-modal-close-btn"
            onClick={onClose}
            title="Cerrar modal (Esc)"
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="request-detail-modal-content">
          <RequestDetail
            requestId={requestId}
            onClose={onClose}
            onUpdated={onUpdated}
          />
        </div>
      </div>
    </div>
  );
}
