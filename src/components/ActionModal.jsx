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
          <h3>
            {isReject ? '❌ ' : '✅ '} {title}
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
                    ? 'Explicá el motivo por el cual no es posible atender la solicitud...'
                    : 'Detallá los cambios realizados o la solución brindada...'
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
                : 'Marcar como Resuelta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
