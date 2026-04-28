import { useNavigate } from 'react-router-dom';
import { fmtDate, statusLabel, statusBadgeClass } from '../utils/format';

export default function EventCard({ event }) {
  const navigate = useNavigate();

  return (
    <div className="event-card" onClick={() => navigate(`/events/${event.id}`)}>
      <div className="event-card__banner">
        {event.poster_url ? (
          <img className="event-card__img" src={event.poster_url} alt={event.name} loading="lazy" />
        ) : (
          <div className="event-card__placeholder">🎵</div>
        )}
      </div>

      <div className="event-card__body">
        <div style={{ marginBottom: 'var(--sp-2)' }}>
          <span className={`badge ${statusBadgeClass(event.status)}`}>
            {statusLabel(event.status)}
          </span>
        </div>
        <h3 className="event-card__title">{event.name}</h3>
        <p className="event-card__meta">
          📅 {fmtDate(event.start_time)}
        </p>
        <p className="event-card__meta">
          📍 {event.venue?.name ?? '—'}
        </p>
      </div>

      <div className="event-card__footer">
        <span className="event-card__price">
          {event.sections?.length
            ? `Từ ${new Intl.NumberFormat('vi-VN').format(Math.min(...event.sections.map(s => s.price)))}đ`
            : 'Xem chi tiết'}
        </span>
        <span className="btn btn-ghost btn-sm">Chi tiết →</span>
      </div>
    </div>
  );
}
