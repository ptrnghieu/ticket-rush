import { useState, useEffect } from 'react';
import { apiMyTickets } from '../services/api';
import QRTicket from '../components/QRTicket';

export default function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiMyTickets()
      .then(setTickets)
      .catch(() => setError('Không thể tải danh sách vé'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Vé của tôi</h1>
        <p className="page-sub">Tất cả vé điện tử đã mua</p>
      </div>

      {loading && <div className="spinner-wrap"><div className="spinner spinner-lg" /></div>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && tickets.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🎫</div>
          <p className="empty-state-text">Bạn chưa có vé nào</p>
          <a href="/" className="btn btn-primary">Xem sự kiện →</a>
        </div>
      )}

      {!loading && !error && tickets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', paddingBottom: 'var(--sp-16)' }}>
          {tickets.map(ticket => <QRTicket key={ticket.id} ticket={ticket} />)}
        </div>
      )}
    </div>
  );
}
