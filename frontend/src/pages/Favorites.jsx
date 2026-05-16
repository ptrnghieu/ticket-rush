import { useState, useEffect } from 'react';
import { apiFavoriteEvents } from '../services/api';
import EventCard from '../components/EventCard';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Favorites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    apiFavoriteEvents()
      .then(setEvents)
      .catch(() => setError('Không thể tải danh sách yêu thích'))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-8)', paddingBottom: 'var(--sp-16)' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-2)' }}>
          <span style={{ fontSize: '1.5rem' }}>♥</span>
          <h1 className="page-title" style={{ margin: 0 }}>Sự kiện yêu thích</h1>
        </div>
        <p className="page-sub">Những sự kiện bạn đã lưu để theo dõi</p>
      </div>

      {loading && <div className="spinner-wrap"><div className="spinner spinner-lg" /></div>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && events.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🤍</div>
          <p className="empty-state-text">Bạn chưa yêu thích sự kiện nào</p>
          <a href="/" className="btn btn-primary">Khám phá sự kiện →</a>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <>
          <p style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)', marginBottom: 'var(--sp-6)' }}>
            {events.length} sự kiện đã lưu
          </p>
          <div className="events-grid">
            {events.map(event => <EventCard key={event.id} event={event} />)}
          </div>
        </>
      )}
    </div>
  );
}
