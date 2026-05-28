import Icon from '../Icon.jsx';

// Minimal sortable/searchable list table.
// columns: [{ key, header, render?, sortable?, className? }]
// rows: array of objects with column keys
export default function DataTable({
  columns,
  rows,
  loading,
  error,
  emptyMessage = 'Nothing here yet.',
  rowKey = '_id',
  onRowClick,
}) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center text-on-surface-variant shadow-md">
        Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl bg-error-container/30 p-6 text-center text-on-error-container shadow-md">
        Could not load ({error.status || 'network error'}). Try again.
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center text-on-surface-variant shadow-md">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-md">
      <table className="w-full text-left">
        <thead className="border-b border-surface-variant bg-surface-container-low">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-3 text-base font-bold uppercase tracking-wider text-on-surface-variant ${c.className || ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row[rowKey] ?? i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-surface-variant/50 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-surface-container-low' : ''}`}
            >
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 text-base text-on-surface ${c.className || ''}`}>
                  {c.render ? c.render(row) : row[c.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
