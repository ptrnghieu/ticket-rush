import { useState, useEffect, useMemo } from 'react';
import { apiListEvents } from '../services/api';
import EventCard from '../components/EventCard';

const TYPE_FILTERS = [
  { label: 'Tất cả', value: '' },
  { label: 'Hòa nhạc', value: 'concert' },
  { label: 'Lễ hội', value: 'festival' },
  { label: 'Sân khấu', value: 'theater' },
  { label: 'Thể thao', value: 'sports' },
  { label: 'Hội thảo', value: 'conference' },
  { label: 'Điện ảnh', value: 'cinema' },
  { label: 'Hài kịch', value: 'comedy' },
  { label: 'Khác', value: 'other' },
];

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    apiListEvents({ limit: 100, event_type: typeFilter || undefined })
      .then(setEvents)
      .catch(() => setError('Không thể tải danh sách sự kiện'))
      .finally(() => setLoading(false));
  }, [typeFilter]);

  const filtered = useMemo(() => {
    if (!search) return events;
    const q = search.toLowerCase();
    return events.filter(e => e.name.toLowerCase().includes(q));
  }, [events, search]);

  return (
    <>
      <section className="hero">
        <div className="container hero-content">
          <p className="hero-eyebrow">🎫 TicketRush</p>
          <h1 className="hero-title">Khám phá &amp;<br />Đặt vé sự kiện</h1>
          <p className="hero-sub">Mua vé nhanh, đặt chỗ dễ dàng. Hàng trăm sự kiện âm nhạc và giải trí.</p>
        </div>
      </section>

      <main className="events-section">
        <div className="container">
          <div className="events-controls">
            <div className="search-wrap">
              <span className="search-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="search"
                className="input"
                placeholder="Tìm kiếm sự kiện..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="filter-tabs">
              {TYPE_FILTERS.map(f => (
                <button
                  key={f.value}
                  className={`filter-tab${typeFilter === f.value ? ' active' : ''}`}
                  onClick={() => setTypeFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loading && <div className="spinner-wrap"><div className="spinner spinner-lg" /></div>}
          {error && <div className="alert alert-error">{error}</div>}

          {!loading && !error && (
            <>
              <span className="events-count">{filtered.length} sự kiện đang mở bán</span>
              {filtered.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🎭</div>
                  <p className="empty-state-text">Không tìm thấy sự kiện nào</p>
                </div>
              ) : (
                <div className="events-grid">
                  {filtered.map(event => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
