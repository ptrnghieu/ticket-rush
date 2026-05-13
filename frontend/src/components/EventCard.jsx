import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtDate, statusLabel, statusBadgeClass } from '../utils/format';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '../hooks/useAuth';

export default function EventCard({ event }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { favoriteIds, toggle } = useFavorites();
  const [count, setCount] = useState(event.favorite_count ?? 0);
  const isFav = favoriteIds.has(event.id);

  async function handleFav(e) {
    e.stopPropagation();
    if (!user) { navigate('/login'); return; }
    await toggle(event.id, count, setCount);
  }

  return (
    <div className="event-card" onClick={() => navigate(`/events/${event.id}`)}>
      <div className="event-card__banner">
        {event.poster_url ? (
          <img className="event-card__img" src={event.poster_url} alt={event.name} loading="lazy" />
        ) : (
          <div className="event-card__placeholder">🎵</div>
        )}
        <button
          className={`fav-btn${isFav ? ' fav-btn--active' : ''}`}
          onClick={handleFav}
          title={isFav ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
        >
          {isFav ? '♥' : '♡'}
        </button>
      </div>

      <div className="event-card__body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <span className={`badge ${statusBadgeClass(event.status)}`}>
            {statusLabel(event.status)}
          </span>
          {event.event_type && (
            <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>
              {event.event_type}
            </span>
          )}
        </div>
        <h3 className="event-card__title">{event.name}</h3>
        <p className="event-card__meta">📅 {fmtDate(event.start_time)}</p>
        <p className="event-card__meta">📍 {event.venue?.name ?? '—'}</p>
      </div>

      <div className="event-card__footer">
        <span className="event-card__price">
          {event.sections?.length
            ? `Từ ${new Intl.NumberFormat('vi-VN').format(Math.min(...event.sections.map(s => s.price)))}đ`
            : 'Xem chi tiết'}
        </span>
        <span className="fav-count">♥ {count}</span>
      </div>
    </div>
  );
}
