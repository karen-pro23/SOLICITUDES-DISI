import './ImagePreviewModal.css';

export default function ImagePreviewModal({ src, alt = '', onClose }) {
  return (
    <div className="image-preview-overlay" onClick={onClose}>
      <div
        className="image-preview-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="image-preview-close"
          onClick={onClose}
          aria-label="Cerrar vista previa"
        >
          ✕
        </button>
        <img src={src} alt={alt} className="image-preview-img" />
      </div>
    </div>
  );
}
