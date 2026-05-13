import { useState, useEffect, useMemo } from 'react';
import { apiListEvents, apiTrendingEvents } from '../services/api';
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

const PRICE_FILTERS = [
  { label: 'Tất cả', min: 0, max: Infinity },
  { label: 'Dưới 200k', min: 0, max: 200000 },
  { label: '200k – 500k', min: 200000, max: 500000 },
  { label: 'Trên 500k', min: 500000, max: Infinity },
];

const DATE_FILTERS = [
  { label: 'Tất cả', value: '' },
  { label: 'Hôm nay', value: 'today' },
  { label: 'Tuần này', value: 'week' },
  { label: 'Tháng này', value: 'month' },
];

function getDateRange(value) {
  const now = new Date();
  if (value === 'today') {
    const end = new Date(now); end.setHours(23, 59, 59);
    return { date_from: now.toISOString(), date_to: end.toISOString() };
  }
  if (value === 'week') {
    const end = new Date(now); end.setDate(now.getDate() + 7);
    return { date_from: now.toISOString(), date_to: end.toISOString() };
  }
  if (value === 'month') {
    const end = new Date(now); end.setMonth(now.getMonth() + 1);
    return { date_from: now.toISOString(), date_to: end.toISOString() };
  }
  return {};
}

export default function Home() {
  const [events, setEvents] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [priceFilter, setPriceFilter] = useState(0); // index into PRICE_FILTERS
  const [showFilters, setShowFilters] = useState(false);

  // Fetch trending once
  useEffect(() => {
    apiTrendingEvents(6).then(setTrending).catch(() => {});
  }, []);

  // Fetch events when type or date changes (backend filters)
  useEffect(() => {
    setLoading(true);
    const dateRange = getDateRange(dateFilter);
    apiListEvents({ limit: 100, event_type: typeFilter || undefined, ...dateRange })
      .then(setEvents)
      .catch(() => setError('Không thể tải danh sách sự kiện'))
      .finally(() => setLoading(false));
  }, [typeFilter, dateFilter]);

  // Price filter is client-side (needs section prices)
  const filtered = useMemo(() => {
    let result = events;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e => e.name.toLowerCase().includes(q));
    }
    const { min, max } = PRICE_FILTERS[priceFilter];
    if (min > 0 || max < Infinity) {
      result = result.filter(e => {
        if (!e.sections?.length) return true;
        const minPrice = Math.min(...e.sections.map(s => s.price));
        return minPrice >= min && minPrice <= max;
      });
    }
    return result;
  }, [events, search, priceFilter]);

  const hasActiveFilter = typeFilter || dateFilter || priceFilter > 0;

  return (
    <>
      {/* Hero with embedded search */}
      <section className="hero">
        <div className="container hero-content">
          <p className="hero-eyebrow">🎫 TicketRush</p>
          <h1 className="hero-title">Khám phá &amp;<br />Đặt vé sự kiện</h1>
          <p className="hero-sub">Mua vé nhanh, đặt chỗ dễ dàng. Hàng trăm sự kiện âm nhạc và giải trí.</p>

          <div className="hero-search">
            <span className="search-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="search"
              className="input"
              placeholder="Tìm kiếm sự kiện, địa điểm..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </section>

      <main className="events-section">
        <div className="container">

          {/* Trending section */}
          {trending.length > 0 && !search && !hasActiveFilter && (
            <section style={{ marginBottom: 'var(--sp-10)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
                <span style={{ fontSize: '1.2rem' }}>🔥</span>
                <h2 style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>Sự kiện xu hướng</h2>
              </div>
              <div className="events-grid">
                {trending.map(event => <EventCard key={event.id} event={event} />)}
              </div>
            </section>
          )}

          {/* Filter bar */}
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            {/* Type tabs */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
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
              <button
                className={`btn btn-ghost btn-sm${showFilters ? ' active' : ''}`}
                onClick={() => setShowFilters(v => !v)}
                style={{ whiteSpace: 'nowrap' }}
              >
                ⚙ Lọc nâng cao {hasActiveFilter && <span className="badge badge-amber" style={{ marginLeft: 4, fontSize: 10 }}>!</span>}
              </button>
            </div>

            {/* Advanced filter panel */}
            {showFilters && (
              <div className="card" style={{ marginTop: 'var(--sp-3)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginBottom: 'var(--sp-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Thời gian</p>
                  <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                    {DATE_FILTERS.map(f => (
                      <button
                        key={f.value}
                        className={`btn btn-sm ${dateFilter === f.value ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setDateFilter(f.value)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginBottom: 'var(--sp-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Mức giá</p>
                  <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                    {PRICE_FILTERS.map((f, i) => (
                      <button
                        key={i}
                        className={`btn btn-sm ${priceFilter === i ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setPriceFilter(i)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                {hasActiveFilter && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setTypeFilter(''); setDateFilter(''); setPriceFilter(0); }}>
                      ✕ Xóa bộ lọc
                    </button>
                  </div>
                )}
              </div>
            )}
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
                  {filtered.map(event => <EventCard key={event.id} event={event} />)}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
