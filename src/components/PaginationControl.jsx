import React from 'react';
import './PaginationControl.css';

export default function PaginationControl({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  limit = 10,
  onPageChange,
  onLimitChange,
}) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalItems);

  const getPageNumbers = () => {
    const delta = 1;
    const range = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      range.unshift('...');
    }
    if (currentPage + delta < totalPages - 1) {
      range.push('...');
    }

    range.unshift(1);
    if (totalPages > 1) {
      range.push(totalPages);
    }

    return range;
  };

  return (
    <div className="pagination-bar">
      <div className="pagination-info">
        <span>
          Mostrando <strong>{startItem}</strong> - <strong>{endItem}</strong> de <strong>{totalItems}</strong> solicitudes
        </span>
        {onLimitChange && (
          <div className="pagination-limit-select">
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              aria-label="Registros por página"
            >
              <option value={10}>10 por pág.</option>
              <option value={20}>20 por pág.</option>
              <option value={50}>50 por pág.</option>
            </select>
          </div>
        )}
      </div>

      <div className="pagination-buttons">
        <button
          type="button"
          className="btn-page btn-prev"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Página anterior"
        >
          ‹ Anterior
        </button>

        <div className="page-numbers">
          {getPageNumbers().map((p, idx) => (
            p === '...' ? (
              <span key={`dots-${idx}`} className="page-ellipsis">...</span>
            ) : (
              <button
                key={`page-${p}`}
                type="button"
                className={`btn-page-number ${p === currentPage ? 'active' : ''}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            )
          ))}
        </div>

        <button
          type="button"
          className="btn-page btn-next"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Página siguiente"
        >
          Siguiente ›
        </button>
      </div>
    </div>
  );
}
