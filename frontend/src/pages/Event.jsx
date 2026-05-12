import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { apiGetEvent, apiLockSeats, apiJoinQueue } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import SeatMap from "../components/SeatMap";
import QueueRoom from "../components/QueueRoom";
import {
  fmtDate,
  fmtVND,
  statusLabel,
  statusBadgeClass,
} from "../utils/format";

export default function Event() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const admitted = searchParams.get("admitted") === "1";
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selection, setSelection] = useState({
    selectedIds: [],
    seats: [],
    total: 0,
  });
  const [locking, setLocking] = useState(false);
  const [lockError, setLockError] = useState("");

  const [inQueue, setInQueue] = useState(false);
  const [joiningQueue, setJoiningQueue] = useState(false);

  useEffect(() => {
    apiGetEvent(id)
      .then(setEvent)
      .catch(() => setError("Không thể tải thông tin sự kiện"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSelectionChange = useCallback((sel) => setSelection(sel), []);

  async function handleLockAndCheckout() {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!selection.selectedIds.length) return;
    setLocking(true);
    setLockError("");
    try {
      const locks = await apiLockSeats(selection.selectedIds);
      const lockIds = locks.map((l) => l.id);
      navigate("/checkout", {
        state: {
          event,
          seats: selection.seats,
          total: selection.total,
          lockIds,
          seatIds: selection.selectedIds,
        },
      });
    } catch (err) {
      setLockError(
        err.response?.data?.detail ?? "Không thể giữ ghế. Vui lòng thử lại.",
      );
    } finally {
      setLocking(false);
    }
  }

  async function handleJoinQueue() {
    if (!user) {
      navigate("/login");
      return;
    }
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
    return (
      <div className="spinner-wrap">
        <div className="spinner spinner-lg" />
      </div>
    );
  if (error)
    return (
      <div className="container" style={{ padding: "var(--sp-8)" }}>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  if (!event) return null;

  const isOnSale = event.status === "on_sale";
  const showQueue = inQueue && !admitted;

  return (
    <>
      {/* Hero */}
      <div className="event-hero">
        {event.poster_url ? (
          <>
            <img
              className="event-hero__img"
              src={event.poster_url}
              alt={event.name}
            />
            <div className="event-hero__overlay" />
          </>
        ) : (
          <div className="event-hero__placeholder">🎵</div>
        )}
      </div>

      <div className="container">
        {/* Header */}
        <div className="event-header">
          <div style={{ marginBottom: "var(--sp-3)" }}>
            <span className={`badge ${statusBadgeClass(event.status)}`}>
              {statusLabel(event.status)}
            </span>
          </div>
          <h1 className="event-title">{event.name}</h1>
          <div className="event-meta-grid">
            <div className="event-meta-item">
              <div>
                <p className="event-meta-label">Thời gian</p>
                <p className="event-meta-val">{fmtDate(event.start_time)}</p>
              </div>
            </div>
            <div className="event-meta-item">
              <div>
                <p className="event-meta-label">Địa điểm</p>
                <p className="event-meta-val">{event.venue?.name}</p>
              </div>
            </div>
            {event.venue?.address && (
              <div className="event-meta-item">
                <div>
                  <p className="event-meta-label">Địa chỉ</p>
                  <p className="event-meta-val">{event.venue.address}</p>
                </div>
              </div>
            )}
          </div>
          {event.description && (
            <p
              style={{
                marginTop: "var(--sp-4)",
                color: "var(--text-2)",
                fontSize: "var(--text-sm)",
                lineHeight: 1.7,
                maxWidth: 720,
              }}
            >
              {event.description}
            </p>
          )}
        </div>

        {/* Queue room */}
        {showQueue && <QueueRoom event={event} />}

        {/* Main layout */}
        {!showQueue && isOnSale && event.sections?.length > 0 && (
          <div className="event-layout">
            {/* Seat map */}
            <div>
              <h2 style={{ marginBottom: "var(--sp-4)", fontWeight: 700 }}>
                Chọn ghế
              </h2>
              <SeatMap
                event={event}
                sections={event.sections}
                onSelectionChange={handleSelectionChange}
              />
            </div>

            {/* Selection panel */}
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
                      <span className="total-price">
                        {fmtVND(selection.total)}
                      </span>
                    </div>
                  </>
                )}

                {lockError && (
                  <div
                    className="alert alert-error"
                    style={{
                      marginTop: "var(--sp-3)",
                      fontSize: "var(--text-xs)",
                    }}
                  >
                    {lockError}
                  </div>
                )}

                <button
                  className="btn btn-primary btn-full"
                  style={{ marginTop: "var(--sp-4)" }}
                  disabled={!selection.seats.length || locking}
                  onClick={handleLockAndCheckout}
                >
                  {locking
                    ? "Đang giữ ghế..."
                    : `Đặt ${selection.seats.length || ""} ghế →`}
                </button>

                <p
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-3)",
                    marginTop: "var(--sp-2)",
                    textAlign: "center",
                  }}
                >
                  Ghế sẽ được giữ 1 phút
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Queue join (when queue mode is active) */}
        {!showQueue &&
          !admitted &&
          isOnSale &&
          !inQueue &&
          event.sections?.length === 0 && (
            <div style={{ textAlign: "center", padding: "var(--sp-12) 0" }}>
              <div style={{ fontSize: "3rem", marginBottom: "var(--sp-4)" }}>
                ⏳
              </div>
              <h2 style={{ marginBottom: "var(--sp-3)" }}>
                Sự kiện đang mở bán qua hàng đợi
              </h2>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleJoinQueue}
                disabled={joiningQueue}
              >
                {joiningQueue ? "Đang tham gia..." : "Tham gia hàng đợi"}
              </button>
            </div>
          )}

        {!isOnSale && (
          <div className="empty-state">
            <div className="empty-state-icon">🎭</div>
            <p className="empty-state-text">Sự kiện này hiện chưa mở bán</p>
            <a href="/" className="btn btn-ghost">
              ← Quay lại trang chủ
            </a>
          </div>
        )}
      </div>
    </>
  );
}
