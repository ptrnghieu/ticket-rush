import { fmtDate } from '../utils/format';

export default function QRTicket({ ticket }) {
  const seat = ticket.seat;
  const section = seat?.section;
  const event = section?.event;
  const venue = event?.venue;

  const seatLabel = seat
    ? `${seat.row_label ?? seat.row_number}${seat.seat_number}`
    : `Ghế #${ticket.seat_id}`;

  return (
    <div className="ticket-card">
      <div className="ticket-qr">
        {ticket.qr_code ? (
          <img src={ticket.qr_code} alt="QR vé" />
        ) : (
          <span style={{ fontSize: '2rem' }}>🎫</span>
        )}
      </div>

      <div className="ticket-info">
        {/* Event name */}
        <h3 style={{ marginBottom: 'var(--sp-1)' }}>
          {event?.name ?? `Vé #${ticket.id}`}
        </h3>

        {/* Event date & venue */}
        {event && (
          <p className="ticket-meta" style={{ marginBottom: 'var(--sp-1)' }}>
            📅 {fmtDate(event.start_time)}
            {event.end_time && ` – ${fmtDate(event.end_time)}`}
          </p>
        )}
        {venue && (
          <p className="ticket-meta" style={{ marginBottom: 'var(--sp-3)' }}>
            📍 {venue.name}{venue.location ? ` · ${venue.location}` : ''}
          </p>
        )}

        {/* Seat details */}
        <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', marginBottom: 'var(--sp-3)' }}>
          <div className="ticket-detail-chip">
            <span className="ticket-detail-label">Ghế</span>
            <strong>{seatLabel}</strong>
          </div>
          {section && (
            <div className="ticket-detail-chip">
              <span className="ticket-detail-label">Khu vực</span>
              <strong>{section.name}</strong>
            </div>
          )}
          {section && (
            <div className="ticket-detail-chip">
              <span className="ticket-detail-label">Giá</span>
              <strong>{new Intl.NumberFormat('vi-VN').format(section.price)}đ</strong>
            </div>
          )}
        </div>

        <p className="ticket-meta">Mã vé: #{ticket.id} · Đặt lúc: {fmtDate(ticket.issued_at)}</p>
        <div style={{ marginTop: 'var(--sp-3)' }}>
          <span className="badge badge-green">Đã xác nhận</span>
        </div>
      </div>
    </div>
  );
}
