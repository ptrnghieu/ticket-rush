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

const TYPE_ICONS = {
  concert: '🎵', festival: '🎪', theater: '🎭', sports: '⚽',
  conference: '💼', cinema: '🎬', comedy: '😂', other: '✨',
};

const RANK_BADGES = [
  { bg: 'linear-gradient(135deg,#f59e0b,#ef4444)', label: '🥇' },
  { bg: 'linear-gradient(135deg,#94a3b8,#64748b)', label: '🥈' },
  { bg: 'linear-gradient(135deg,#cd7c2f,#92400e)', label: '🥉' },
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

function getThisWeekendRange() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun,6=Sat
  const daysToSat = day === 6 ? 0 : (6 - day);
  const sat = new Date(now); sat.setDate(now.getDate() + daysToSat); sat.setHours(0, 0, 0, 0);
  const sun = new Date(sat); sun.setDate(sat.getDate() + 1); sun.setHours(23, 59, 59, 999);
  return { from: sat, to: sun };
}

function getEndOfMonthRange() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const startFrom = new Date(lastDay); startFrom.setDate(lastDay.getDate() - 6); startFrom.setHours(0, 0, 0, 0);
  return { from: startFrom, to: lastDay };
}

export default function Home() {
  const [events, setEvents] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [priceFilter, setPriceFilter] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    apiTrendingEvents(6).then(setTrending).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const dateRange = getDateRange(dateFilter);
    apiListEvents({ limit: 100, event_type: typeFilter || undefined, ...dateRange })
      .then(setEvents)
      .catch(() => setError('Không thể tải danh sách sự kiện'))
      .finally(() => setLoading(false));
  }, [typeFilter, dateFilter]);

  const filtered = useMemo(() => {
    let result = events;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e => e.name.toLowerCase().includes(q) || e.venue?.name?.toLowerCase().includes(q));
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

  // Derived suggestion lists (only shown when no filters active)
  const { weekendEvents, endMonthEvents, byType } = useMemo(() => {
    if (hasActiveFilter || search) return { weekendEvents: [], endMonthEvents: [], byType: {} };
    const { from: wFrom, to: wTo } = getThisWeekendRange();
    const { from: mFrom, to: mTo } = getEndOfMonthRange();
    const weekendEvents = events.filter(e => {
      const d = new Date(e.start_time);
      return d >= wFrom && d <= wTo;
    }).slice(0, 4);
    const endMonthEvents = events.filter(e => {
      const d = new Date(e.start_time);
      return d >= mFrom && d <= mTo;
    }).slice(0, 4);
    // Pick top 4 events per type that aren't already in trending
    const trendingIds = new Set(trending.map(t => t.id));
    const byType = {};
    for (const tf of TYPE_FILTERS.slice(1)) {
      const items = events.filter(e => e.event_type === tf.value && !trendingIds.has(e.id)).slice(0, 4);
      if (items.length >= 2) byType[tf.value] = { label: tf.label, icon: TYPE_ICONS[tf.value], items };
    }
    return { weekendEvents, endMonthEvents, byType };
  }, [events, trending, hasActiveFilter, search]);

  return (
    <>
      {/* Hero */}
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

          {/* Quick time chips */}
          {!search && (
            <div className="hero-chips">
              <button className={`hero-chip${dateFilter === 'today' ? ' active' : ''}`} onClick={() => { setDateFilter(d => d === 'today' ? '' : 'today'); setShowFilters(false); }}>
                📅 Hôm nay
              </button>
              <button className={`hero-chip${dateFilter === 'week' ? ' active' : ''}`} onClick={() => { setDateFilter(d => d === 'week' ? '' : 'week'); setShowFilters(false); }}>
                📆 Tuần này
              </button>
              <button className={`hero-chip hero-chip--fire`} onClick={() => { setDateFilter(d => d === 'month' ? '' : 'month'); setShowFilters(false); }}>
                🔥 Cuối tháng
              </button>
            </div>
          )}
        </div>
      </section>

      <main className="events-section">
        <div className="container">

          {/* Trending */}
          {trending.length > 0 && !search && !hasActiveFilter && (
            <section className="home-section">
              <div className="section-heading">
                <span style={{ fontSize: '1.2rem' }}>🔥</span>
                <h2 className="section-title">Sự kiện xu hướng</h2>
              </div>
              <div className="events-grid trending-grid">
                {trending.map((event, idx) => (
                  <div key={event.id} className="trending-item">
                    {idx < 3 && (
                      <div className="rank-badge" style={{ background: RANK_BADGES[idx].bg }}>
                        {RANK_BADGES[idx].label} #{idx + 1}
                      </div>
                    )}
                    <EventCard event={event} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* This weekend */}
          {weekendEvents.length > 0 && (
            <section className="home-section">
              <div className="section-heading">
                <span style={{ fontSize: '1.2rem' }}>🎉</span>
                <h2 className="section-title">Cuối tuần này</h2>
                <span className="section-badge">Đừng bỏ lỡ!</span>
              </div>
              <div className="events-grid">
                {weekendEvents.map(event => <EventCard key={event.id} event={event} />)}
              </div>
            </section>
          )}

          {/* End of month */}
          {endMonthEvents.length > 0 && (
            <section className="home-section">
              <div className="section-heading">
                <span style={{ fontSize: '1.2rem' }}>🔥</span>
                <h2 className="section-title">Cuối tháng này</h2>
                <span className="section-badge section-badge--fire">Đang hot!</span>
              </div>
              <div className="events-grid">
                {endMonthEvents.map(event => <EventCard key={event.id} event={event} />)}
              </div>
            </section>
          )}

          {/* By category suggestions */}
          {!search && !hasActiveFilter && Object.entries(byType).map(([type, { label, icon, items }]) => (
            <section key={type} className="home-section">
              <div className="section-heading">
                <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                <h2 className="section-title">{label}</h2>
                <button
                  className="section-more"
                  onClick={() => { setTypeFilter(type); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  Xem tất cả →
                </button>
              </div>
              <div className="events-grid">
                {items.map(event => <EventCard key={event.id} event={event} />)}
              </div>
            </section>
          ))}

          {/* Filter bar */}
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
              <div className="filter-tabs" style={{ flexWrap: 'wrap' }}>
                {TYPE_FILTERS.map(f => (
                  <button
                    key={f.value}
                    className={`filter-tab${typeFilter === f.value ? ' active' : ''}`}
                    onClick={() => setTypeFilter(f.value)}
                  >
                    {f.value && TYPE_ICONS[f.value] ? `${TYPE_ICONS[f.value]} ` : ''}{f.label}
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
