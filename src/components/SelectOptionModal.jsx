import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import './ActionModal.css';
import './SelectOptionModal.css';

export default function SelectOptionModal({
  isOpen,
  onClose,
  title,
  description,
  options = [],
  onSelect,
  noteConfig = null,
  assetConfig = null,
  initialAsset = '',
  submitting = false,
}) {
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [assetConsecutive, setAssetConsecutive] = useState('');

  // Reset al abrir el modal
  useEffect(() => {
    if (isOpen) {
      setSelected(null);
      setNote('');
      setAssetConsecutive(initialAsset || '');
    }
  }, [isOpen, initialAsset]);

  if (!isOpen) return null;

  // Cuando noteConfig o assetConfig están definidos, tras elegir una opción se muestra
  // el formulario + CONFIRMAR (flujo "seleccionar y luego notar").
  const showDetails = (Boolean(noteConfig) || Boolean(assetConfig)) && selected !== null;

  function handleOptionClick(option) {
    if (option.disabled || submitting) return;
    setSelected(option.value);
    setNote('');
    if (!noteConfig && !assetConfig) {
      onSelect(option.value, null, null);
    }
  }

  function handleConfirm() {
    if (submitting) return;
    if (noteConfig?.required && !note.trim()) return;
    if (assetConfig?.required && !assetConsecutive.trim()) return;
    onSelect(selected, note.trim(), assetConsecutive.trim());
  }

  function handleClose() {
    setSelected(null);
    setNote('');
    setAssetConsecutive('');
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close-btn" onClick={handleClose} disabled={submitting} aria-label="Cerrar modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {description && <p>{description}</p>}

          <div className="option-list">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`option-btn ${option.active ? 'active' : ''}`}
                disabled={option.disabled || submitting}
                aria-disabled={option.disabled || submitting}
                aria-pressed={option.active}
                onClick={() => handleOptionClick(option)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {showDetails && assetConfig && (
            <div className="option-note" style={{ marginTop: '1rem' }}>
              <label>{assetConfig.label}</label>
              <input
                type="text"
                value={assetConsecutive}
                onChange={(e) => setAssetConsecutive(e.target.value.toUpperCase())}
                placeholder={assetConfig.placeholder}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                }}
                disabled={submitting}
                required={assetConfig.required}
                autoFocus={!noteConfig}
              />
            </div>
          )}

          {showDetails && noteConfig && (
            <div className="option-note" style={{ marginTop: '1rem' }}>
              <label>{noteConfig.label}</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={noteConfig.placeholder}
                rows={4}
                autoFocus={Boolean(noteConfig)}
                disabled={submitting}
              />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </button>
          {showDetails && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={
                submitting ||
                (noteConfig?.required && !note.trim()) ||
                (assetConfig?.required && !assetConsecutive.trim())
              }
            >
              {submitting ? 'Guardando...' : 'CONFIRMAR'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
