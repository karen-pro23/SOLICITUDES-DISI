import { useState } from 'react';
import './ActionModal.css';

export default function ActionModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  description,
  ticketCode,
  actionType = 'resolve',
  submitting = false,
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isReject = actionType === 'reject';

  function handleSubmit(e) {
    e.preventDefault();
    if (isReject && !text.trim()) {
      setError('El motivo del rechazo es obligatorio para notificar al departamento.');
      return;
    }
    setError('');
    onSubmit(text);
    setText('');
  }

  function handleClose() {
    setText('');
    setError('');
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            {isReject ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            )} {title}
          </h3>
          <button className="modal-close-btn" onClick={handleClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {ticketCode && <div className="modal-ticket-badge">Ticket: {ticketCode}</div>}
            <p>{description}</p>

            {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>
                {isReject ? 'Motivo del Rechazo *' : 'Respuesta / Notas de Solución'}
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  isReject
                    ? 'Explique el motivo por el cual no es posible atender la solicitud...'
                    : 'Detallé los cambios realizados o la solución brindada...'
                }
                rows={4}
                required={isReject}
                autoFocus
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={handleClose} disabled={submitting}>
              Cancelar
            </button>
            <button
              type="submit"
              className={`btn ${isReject ? 'btn-danger' : 'btn-success'}`}
              disabled={submitting || (isReject && !text.trim())}
            >
              {submitting
                ? 'Guardando...'
                : isReject
                ? 'Confirmar Rechazo'
                : 'Marcar como Completada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
