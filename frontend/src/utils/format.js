export function fmtVND(n) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND', maximumFractionDigits: 0,
  }).format(n ?? 0);
}

export function fmtDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

export function fmtDateShort(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(iso));
}

export function statusLabel(status) {
  const map = {
    draft:     'Nháp',
    published: 'Đã đăng',
    on_sale:   'Đang bán',
    ended:     'Kết thúc',
    pending:   'Chờ thanh toán',
    paid:      'Đã thanh toán',
    cancelled: 'Đã hủy',
  };
  return map[status] ?? status;
}

export function statusBadgeClass(status) {
  const map = {
    draft:     'badge-gray',
    published: 'badge-blue',
    on_sale:   'badge-green',
    ended:     'badge-gray',
    pending:   'badge-amber',
    paid:      'badge-green',
    cancelled: 'badge-red',
    waiting:   'badge-blue',
    admitted:  'badge-green',
  };
  return map[status] ?? 'badge-gray';
}
