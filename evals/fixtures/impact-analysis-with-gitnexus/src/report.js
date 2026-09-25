export function buildReport(rows) {
  return { count: rows.length, total: rows.reduce((sum, r) => sum + (r.amount ?? 0), 0) };
}
