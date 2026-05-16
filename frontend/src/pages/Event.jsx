import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { apiGetEvent, apiLockSeats, apiJoinQueue, apiListEvents } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useFavorites } from "../hooks/useFavorites";
import SeatMap from "../components/SeatMap";
import QueueRoom from "../components/QueueRoom";
import EventCard from "../components/EventCard";
import {
  fmtDate,
  fmtVND,
  statusLabel,
  statusBadgeClass,
} from "../utils/format";

const TYPE_LABELS = {
  concert: "Hòa nhạc", festival: "Lễ hội", theater: "Sân khấu",
  sports: "Thể thao", conference: "Hội thảo", cinema: "Điện ảnh",
  comedy: "Hài kịch", other: "Khác",
};
const TYPE_ICONS = {
  concert: "🎵", festival: "🎪", theater: "🎭", sports: "⚽",
  conference: "💼", cinema: "🎬", comedy: "😂", other: "✨",
};

function InfoChip({ icon, label, value }) {
  return (
    <div className="info-chip">
      <span className="info-chip__icon">{icon}</span>
      <div>
        <p className="info-chip__label">{label}</p>
        <p className="info-chip__value">{value}</p>
      </div>
    </div>
  );
}

export default function Event() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const admitted = searchParams.get("admitted") === "1";
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [related, setRelated] = useState([]);

  const [selection, setSelection] = useState({ selectedIds: [], seats: [], total: 0 });
  const [locking, setLocking] = useState(false);
  const [lockError, setLockError] = useState("");

  const [inQueue, setInQueue] = useState(false);
  const [joiningQueue, setJoiningQueue] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const { favoriteIds, toggle: toggleFav } = useFavorites();

  useEffect(() => {
    setLoading(true);
    apiGetEvent(id)
      .then(e => { setEvent(e); setFavCount(e.favorite_count ?? 0); })
      .catch(() => setError("Không thể tải thông tin sự kiện"))
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch related events when event type is known
  useEffect(() => {
    if (!event?.event_type) return;
    apiListEvents({ limit: 5, event_type: event.event_type })
      .then(all => setRelated(all.filter(e => e.id !== event.id).slice(0, 4)))
      .catch(() => {});
  }, [event]);

  async function handleFav() {
    if (!user) { navigate("/login"); return; }
    await toggleFav(Number(id), favCount, setFavCount);
  }

  const handleSelectionChange = useCallback((sel) => setSelection(sel), []);

  async function handleLockAndCheckout() {
    if (!user) { navigate("/login"); return; }
    if (!selection.selectedIds.length) return;
    setLocking(true);
    setLockError("");
    try {
      const locks = await apiLockSeats(selection.selectedIds);
      const lockIds = locks.map((l) => l.id);
      navigate("/checkout", {
        state: { event, seats: selection.seats, total: selection.total, lockIds, seatIds: selection.selectedIds },
      });
    } catch (err) {
      setLockError(err.response?.data?.detail ?? "Không thể giữ ghế. Vui lòng thử lại.");
    } finally {
      setLocking(false);
    }
  }

  async function handleJoinQueue() {
    if (!user) { navigate("/login"); return; }
    setJoiningQueue(true);
    try {
      await apiJoinQueue(id);
      setInQueue(true);
    } catch (err) {
      setLockError(err.response?.data?.detail ?? "Không thể tham gia hàng đợi");
    } finally {
      setJoiningQueue(false);
    }
  }

  if (loading)
    return <div className="spinner-wrap"><div className="spinner spinner-lg" /></div>;
  if (error)
    return <div className="container" style={{ padding: "var(--sp-8)" }}><div className="alert alert-error">{error}</div></div>;
  if (!event) return null;

  const isOnSale = event.status === "on_sale";
  const showQueue = inQueue && !admitted;
  const isFav = favoriteIds.has(Number(id));
  const minPrice = event.sections?.length
    ? Math.min(...event.sections.map(s => s.price))
    : null;

  return (
    <>
      {/* Hero */}
      <div className="event-hero">
        {event.poster_url ? (
          <>
            <img className="event-hero__img" src={event.poster_url} alt={event.name} />
            <div className="event-hero__overlay" />
          </>
        ) : (
          <div className="event-hero__placeholder">
            {TYPE_ICONS[event.event_type] ?? "🎵"}
          </div>
        )}
        {/* Floating back button */}
        <button
          className="event-hero__back"
          onClick={() => navigate(-1)}
        >
          ← Quay lại
        </button>
      </div>

      <div className="container">
        {/* Header */}
        <div className="event-header">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-3)", flexWrap: "wrap" }}>
            <span className={`badge ${statusBadgeClass(event.status)}`}>
              {statusLabel(event.status)}
            </span>
            {event.event_type && (
              <span className="badge badge-blue">
                {TYPE_ICONS[event.event_type]} {TYPE_LABELS[event.event_type] ?? event.event_type}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--sp-4)" }}>
            <h1 className="event-title" style={{ margin: 0 }}>{event.name}</h1>
            <button
              onClick={handleFav}
              className={`fav-detail-btn${isFav ? ' fav-detail-btn--active' : ''}`}
            >
              {isFav ? "♥" : "♡"} {favCount}
            </button>
          </div>

          {/* Info chips row */}
          <div className="event-info-chips" style={{ marginTop: "var(--sp-4)" }}>
            <InfoChip icon="📅" label="Thời gian" value={fmtDate(event.start_time)} />
            {event.end_time && <InfoChip icon="🕐" label="Kết thúc" value={fmtDate(event.end_time)} />}
            <InfoChip icon="📍" label="Địa điểm" value={event.venue?.name ?? "—"} />
            {event.venue?.address && <InfoChip icon="🗺" label="Địa chỉ" value={event.venue.address} />}
            {minPrice !== null && <InfoChip icon="🎟" label="Giá từ" value={fmtVND(minPrice)} />}
          </div>

          {event.description && (
            <div className="event-description">
              <h3 className="event-section-subtitle">Giới thiệu sự kiện</h3>
              <p>{event.description}</p>
            </div>
          )}
        </div>

        {/* Sections info */}
        {event.sections?.length > 0 && (
          <div className="card event-sections-card">
            <h3 className="event-section-subtitle" style={{ marginBottom: 'var(--sp-4)' }}>Khu vực & Giá vé</h3>
            <div className="sections-price-grid">
              {event.sections.map(sec => (
                <div key={sec.id} className="section-price-row">
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{sec.name}</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
                      {sec.row_count} hàng × {sec.col_count} ghế = {sec.row_count * sec.col_count} ghế
                    </p>
                  </div>
                  <span className="section-price-tag">{fmtVND(sec.price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Queue room */}
        {showQueue && <QueueRoom event={event} />}

        {/* Seat map */}
        {!showQueue && isOnSale && event.sections?.length > 0 && (
          <div className="event-layout">
            <div>
              <h2 style={{ marginBottom: "var(--sp-4)", fontWeight: 700 }}>Chọn ghế</h2>
              <SeatMap
                event={event}
                sections={event.sections}
                onSelectionChange={handleSelectionChange}
              />
            </div>

            <div>
              <div className="selection-panel">
                <h3>Ghế đã chọn</h3>
                {selection.seats.length === 0 ? (
                  <p className="selection-empty">Chưa chọn ghế nào</p>
                ) : (
                  <>
                    {selection.seats.map((seat) => (
                      <div key={seat.id} className="selected-seat-item">
                        <span>
                          {seat.row_label ?? seat.row_number}
                          {seat.seat_number} — {seat.sectionName}
                        </span>
                        <span style={{ color: "var(--accent)" }}>
                          {fmtVND(seat.price)}
                        </span>
                      </div>
                    ))}
                    <div className="selection-total">
                      <span>Tổng</span>
                      <span className="total-price">{fmtVND(selection.total)}</span>
                    </div>
                  </>
                )}

                {lockError && (
                  <div className="alert alert-error" style={{ marginTop: "var(--sp-3)", fontSize: "var(--text-xs)" }}>
                    {lockError}
                  </div>
                )}

                <button
                  className="btn btn-primary btn-full"
                  style={{ marginTop: "var(--sp-4)" }}
                  disabled={!selection.seats.length || locking}
                  onClick={handleLockAndCheckout}
                >
                  {locking ? "Đang giữ ghế..." : `Đặt ${selection.seats.length || ""} ghế →`}
                </button>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", marginTop: "var(--sp-2)", textAlign: "center" }}>
                  Ghế sẽ được giữ 1 phút
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Queue join */}
        {!showQueue && !admitted && isOnSale && !inQueue && event.sections?.length === 0 && (
          <div style={{ textAlign: "center", padding: "var(--sp-12) 0" }}>
            <div style={{ fontSize: "3rem", marginBottom: "var(--sp-4)" }}>⏳</div>
            <h2 style={{ marginBottom: "var(--sp-3)" }}>Sự kiện đang mở bán qua hàng đợi</h2>
            <button className="btn btn-primary btn-lg" onClick={handleJoinQueue} disabled={joiningQueue}>
              {joiningQueue ? "Đang tham gia..." : "Tham gia hàng đợi"}
            </button>
          </div>
        )}

        {!isOnSale && (
          <div className="empty-state">
            <div className="empty-state-icon">🎭</div>
            <p className="empty-state-text">Sự kiện này hiện chưa mở bán</p>
            <a href="/" className="btn btn-ghost">← Quay lại trang chủ</a>
          </div>
        )}

        {/* Venue highlight */}
        {event.venue && (
          <div className="event-venue-card">
            <div className="event-venue-card__inner">
              <div>
                <p className="info-chip__label" style={{ marginBottom: 'var(--sp-1)' }}>Địa điểm tổ chức</p>
                <h3 style={{ fontWeight: 700, fontSize: 'var(--text-lg)', marginBottom: 'var(--sp-1)' }}>
                  📍 {event.venue.name}
                </h3>
                {event.venue.address && (
                  <p style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>{event.venue.address}</p>
                )}
              </div>
              <div className="venue-map-placeholder">
                <span>🗺</span>
                <p>Bản đồ</p>
              </div>
            </div>
          </div>
        )}

        {/* Related events */}
        {related.length > 0 && (
          <section style={{ marginTop: 'var(--sp-12)', paddingBottom: 'var(--sp-16)' }}>
            <div className="section-heading">
              <span style={{ fontSize: '1.2rem' }}>{TYPE_ICONS[event.event_type] ?? '✨'}</span>
              <h2 className="section-title">Sự kiện tương tự</h2>
              <button
                className="section-more"
                onClick={() => navigate(`/?type=${event.event_type}`)}
              >
                Xem tất cả →
              </button>
            </div>
            <div className="events-grid">
              {related.map(e => <EventCard key={e.id} event={e} />)}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
