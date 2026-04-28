import { useState, useEffect, useMemo } from 'react';
import { apiListEvents } from '../services/api';
import EventCard from '../components/EventCard';

const STATUS_FILTERS = [
  { label: 'Tất cả', value: '' },
  { label: 'Đang mở bán', value: 'on_sale' },
  { label: 'Sắp diễn ra', value: 'published' },
  { label: 'Đã kết thúc', value: 'ended' },
];

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    apiListEvents({ limit: 100 })
      .then(setEvents)
      .catch(() => setError('Không thể tải danh sách sự kiện'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return events.filter(e => {
      const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || e.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [events, search, statusFilter]);

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
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  className={`filter-tab${statusFilter === f.value ? ' active' : ''}`}
                  onClick={() => setStatusFilter(f.value)}
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
              <span className="events-count">{filtered.length} sự kiện</span>
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
