import { useState, useEffect } from 'react';
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
  submitting = false,
}) {
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');

  // Reset al abrir el modal
  useEffect(() => {
    if (isOpen) {
      setSelected(null);
      setNote('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Cuando noteConfig está definido, tras elegir una opción se muestra
  // el área de texto + CONFIRMAR (flujo "seleccionar y luego notar").
  const showNote = Boolean(noteConfig) && selected !== null;

  function handleOptionClick(option) {
    if (option.disabled || submitting) return;
    setSelected(option.value);
    setNote('');
    if (!noteConfig) {
      onSelect(option.value, null);
    }
  }

  function handleConfirm() {
    if (submitting) return;
    if (noteConfig.required && !note.trim()) return;
    onSelect(selected, note.trim());
  }

  function handleClose() {
    setSelected(null);
    setNote('');
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close-btn" onClick={handleClose} disabled={submitting}>
            ✕
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

          {showNote && (
            <div className="option-note">
              <label>{noteConfig.label}</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={noteConfig.placeholder}
                rows={4}
                autoFocus
                disabled={submitting}
              />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </button>
          {showNote && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={submitting || (noteConfig.required && !note.trim())}
            >
              {submitting ? 'Guardando...' : 'CONFIRMAR'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
