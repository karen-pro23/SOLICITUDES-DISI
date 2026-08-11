import './PdfPreviewModal.css';

export default function PdfPreviewModal({ url, name = '', onClose }) {
  return (
    <div className="pdf-preview-overlay" onClick={onClose}>
      <div
        className="pdf-preview-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pdf-preview-header">
          <div className="pdf-preview-title">
            <span>📄</span> {name}
          </div>
          <button
            type="button"
            className="pdf-preview-close"
            onClick={onClose}
            aria-label="Cerrar vista previa"
          >
            ✕
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
