import { FileText, X, Download, ExternalLink } from 'lucide-react';
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <a
              href={url}
              download={name || 'documento.pdf'}
              className="btn btn-sm btn-outline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                textDecoration: 'none',
                color: 'inherit',
                fontSize: '0.75rem',
                padding: '0.3rem 0.6rem',
              }}
              title="Descargar archivo PDF"
            >
              <Download size={14} /> Descargar
            </a>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm btn-outline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                textDecoration: 'none',
                color: 'inherit',
                fontSize: '0.75rem',
                padding: '0.3rem 0.6rem',
              }}
              title="Abrir en pestaña nueva para imprimir"
            >
              <ExternalLink size={14} /> Abrir
            </a>
            <button
              type="button"
              className="pdf-preview-close"
              onClick={onClose}
              aria-label="Cerrar vista previa"
            >
              <X size={18} />
            </button>
          </div>
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
