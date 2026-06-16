/**
 * Accessible pagination component with page size selector,
 * ellipsis, keyboard nav, and aria-current.
 * Per Priority 9 (deep-linking) — supports URL search params.
 */
export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  totalItems,
  siblingCount = 1,
}) {
  if (totalPages <= 1) return null

  // Generate page numbers with ellipsis
  const range = (start, end) => {
    const arr = []
    for (let i = start; i <= end; i++) arr.push(i)
    return arr
  }

  const pages = (() => {
    const totalPageNumbers = siblingCount * 2 + 5 // siblings + first + last + current + 2 ellipsis

    if (totalPages <= totalPageNumbers) {
      return range(1, totalPages)
    }

    const leftSibling = Math.max(currentPage - siblingCount, 1)
    const rightSibling = Math.min(currentPage + siblingCount, totalPages)

    const showLeftDots = leftSibling > 2
    const showRightDots = rightSibling < totalPages - 1

    if (!showLeftDots && showRightDots) {
      const leftRange = range(1, 3 + 2 * siblingCount)
      return [...leftRange, '...', totalPages]
    }

    if (showLeftDots && !showRightDots) {
      const rightRange = range(totalPages - (2 + 2 * siblingCount), totalPages)
      return [1, '...', ...rightRange]
    }

    return [1, '...', ...range(leftSibling, rightSibling), '...', totalPages]
  })()

  const startItem = (currentPage - 1) * (pageSize || 10) + 1
  const endItem = Math.min(currentPage * (pageSize || 10), totalItems || totalPages * (pageSize || 10))

  return (
    <nav className="pagination-container" aria-label="Pagination" role="navigation">
      <div className="pagination-info">
        {totalItems != null && (
          <span className="pagination-summary">
            Showing <strong>{startItem}</strong>–<strong>{endItem}</strong> of <strong className="tabular-nums">{totalItems}</strong>
          </span>
        )}

        {onPageSizeChange && (
          <div className="pagination-page-size">
            <label htmlFor="page-size-select">Per page:</label>
            <select
              id="page-size-select"
              className="form-input-custom"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{ width: 'auto', padding: '4px 8px', fontSize: 13, minHeight: 'auto' }}
            >
              {pageSizeOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <ul className="pagination-list">
        {/* Previous */}
        <li>
          <button
            className="pagination-btn pagination-prev"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Go to previous page"
          >
            <i className="bi bi-chevron-left" />
          </button>
        </li>

        {/* Page numbers */}
        {pages.map((page, idx) => (
          <li key={`${page}-${idx}`}>
            {page === '...' ? (
              <span className="pagination-ellipsis" aria-hidden="true">…</span>
            ) : (
              <button
                className={`pagination-btn ${page === currentPage ? 'active' : ''}`}
                onClick={() => onPageChange(page)}
                aria-label={`Go to page ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            )}
          </li>
        ))}

        {/* Next */}
        <li>
          <button
            className="pagination-btn pagination-next"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Go to next page"
          >
            <i className="bi bi-chevron-right" />
          </button>
        </li>
      </ul>
    </nav>
  )
}
