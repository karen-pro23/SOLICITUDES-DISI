import { useState, useEffect } from 'react';
import { X, XCircle, CheckCircle2, Laptop } from 'lucide-react';
import './ActionModal.css';

export default function ActionModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  description,
  ticketCode,
  actionType = 'resolve', // resolve | reject | asset_only
  submitting = false,
  requireAsset = false,
  initialAsset = '',
}) {
  const [text, setText] = useState('');
  const [assetConsecutive, setAssetConsecutive] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setText('');
      setAssetConsecutive(initialAsset || '');
      setError('');
    }
  }, [isOpen, initialAsset]);

  if (!isOpen) return null;

  const isReject = actionType === 'reject';
  const isAssetOnly = actionType === 'asset_only';

  function handleSubmit(e) {
    e.preventDefault();

    if (requireAsset && !assetConsecutive.trim()) {
      setError('El número de bien es obligatorio.');
      return;
    }

    if (isReject && !text.trim()) {
      setError('El motivo del rechazo es obligatorio para notificar al departamento.');
      return;
    }

    if (!isAssetOnly && !isReject && !text.trim()) {
      setError('La observación es obligatoria al completar la tarea.');
      return;
    }

    setError('');
    onSubmit(text.trim(), assetConsecutive.trim());
    setText('');
    setAssetConsecutive('');
  }

  function handleClose() {
    setText('');
    setAssetConsecutive('');
    setError('');
    onClose();
  }

  const isSubmitDisabled =
    submitting ||
    (requireAsset && !assetConsecutive.trim()) ||
    (isReject && !text.trim()) ||
    (!isAssetOnly && !isReject && !text.trim());

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            {isReject ? (
              <XCircle size={18} color="#ef4444" strokeWidth={2.5} />
            ) : isAssetOnly ? (
              <Laptop size={18} color="#3b82f6" strokeWidth={2.5} />
            ) : (
              <CheckCircle2 size={18} color="#10b981" strokeWidth={2.5} />
            )} {title}
          </h3>
          <button className="modal-close-btn" onClick={handleClose} aria-label="Cerrar modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {ticketCode && <div className="modal-ticket-badge">Ticket: {ticketCode}</div>}
            {description && <p>{description}</p>}

            {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            {requireAsset && (
              <div className="form-group" style={{ marginBottom: isAssetOnly ? 0 : '1rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.8125rem', display: 'block', marginBottom: '0.375rem' }}>
                  Número / Código del Bien * (Obligatorio)
                </label>
                <input
                  type="text"
                  value={assetConsecutive}
                  onChange={(e) => setAssetConsecutive(e.target.value.toLocaleUpperCase())}
                  placeholder="Ej: 0271, CPU-004, IMP-203..."
                  style={{ width: '100%', padding: '0.625rem', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem' }}
                  required
                  autoFocus={requireAsset}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                  Identificador o consecutivo del bien para la atención y reporte oficial.
                </span>
              </div>
            )}

            {!isAssetOnly && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontWeight: 600, fontSize: '0.8125rem', display: 'block', marginBottom: '0.375rem' }}>
                  {isReject ? 'Motivo del Rechazo *' : 'Observación / Detalle de la Solución * (Obligatorio)'}
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    isReject
                      ? 'Explique el motivo por el cual no es posible atender la solicitud...'
                      : 'Detallé los trabajos realizados o la solución brindada...'
                  }
                  rows={4}
                  required
                  autoFocus={!requireAsset}
                />
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={handleClose} disabled={submitting}>
              Cancelar
            </button>
            <button
              type="submit"
              className={`btn ${isReject ? 'btn-danger' : isAssetOnly ? 'btn-primary' : 'btn-success'}`}
              disabled={isSubmitDisabled}
            >
              {submitting
                ? 'Guardando...'
                : isReject
                ? 'Confirmar Rechazo'
                : isAssetOnly
                ? 'Continuar'
                : 'Marcar como Completada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
