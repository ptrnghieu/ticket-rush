import { fmtDate } from '../utils/format';

export default function QRTicket({ ticket, eventName, seatLabel }) {
  return (
    <div className="ticket-card">
      <div className="ticket-qr">
        {ticket.qr_code ? (
          <img src={`data:image/png;base64,${ticket.qr_code}`} alt="QR vé" />
        ) : (
          <span style={{ fontSize: '2rem' }}>🎫</span>
        )}
      </div>

      <div className="ticket-info">
        <h3>{eventName ?? `Vé #${ticket.id}`}</h3>
        {seatLabel && <p className="ticket-seat">Ghế: <strong>{seatLabel}</strong></p>}
        <p className="ticket-meta">Mã vé: #{ticket.id}</p>
        <p className="ticket-meta">Đặt lúc: {fmtDate(ticket.issued_at)}</p>
        <div style={{ marginTop: 'var(--sp-3)' }}>
          <span className="badge badge-green">Đã xác nhận</span>
        </div>
      </div>
    </div>
  );
}
