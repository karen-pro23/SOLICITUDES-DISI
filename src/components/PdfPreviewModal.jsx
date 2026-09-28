import { FileText, X } from 'lucide-react';
import './PdfPreviewModal.css';

export default function PdfPreviewModal({ url, name = '', onClose }) {
  return (
    <div className="pdf-preview-overlay" onClick={onClose}>
      <div
        className="pdf-preview-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pdf-preview-header">
          <div className="pdf-preview-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} /> <span>{name}</span>
          </div>
          <button
            type="button"
            className="pdf-preview-close"
            onClick={onClose}
            aria-label="Cerrar vista previa"
          >
            <X size={18} />
          </button>
        </div>
        <div className="pdf-preview-body">
          <iframe
            src={url}
            title={`Vista previa de ${name}`}
            className="pdf-preview-frame"
          />
        </div>
      </div>
    </div>
  );
}
