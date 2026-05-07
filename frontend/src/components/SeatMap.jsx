import { useState, useEffect, useCallback, useRef } from "react";
import { apiGetSeatMatrix } from "../services/api";
import { fmtVND } from "../utils/format";
import { useWebSocket } from "../hooks/useWebSocket";

const MAX_SEATS = 4;

export default function SeatMap({ event, sections, onSelectionChange }) {
  // seatId (number) → { ...seat, price, sectionName }
  const [seatMap, setSeatMap] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);

  // Load all section seat matrices in parallel
  useEffect(() => {
    if (!sections?.length) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(sections.map((s) => apiGetSeatMatrix(s.id)))
      .then((matrices) => {
        const map = {};
        matrices.forEach((matrix, i) => {
          const sec = sections[i];
          matrix.seats.forEach((seat) => {
            map[seat.id] = {
              ...seat,
              price: sec.price,
              sectionName: sec.name,
              sectionId: sec.id,
            };
          });
        });
        setSeatMap(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sections]);

  // Notify parent on selection change
  useEffect(() => {
    const seats = Array.from(selected)
      .map((id) => seatMap[id])
      .filter(Boolean);
    const total = seats.reduce((s, seat) => s + seat.price, 0);
    onSelectionChange?.({ selectedIds: Array.from(selected), seats, total });
  }, [selected, seatMap, onSelectionChange]);

  // Live WebSocket updates
  const handleWsMessage = useCallback((msg) => {
    if (msg.type !== "seat_status_changed") return;
    const { seat_id, status } = msg;
    setSeatMap((prev) => {
      if (!prev[seat_id]) return prev;
      return { ...prev, [seat_id]: { ...prev[seat_id], status } };
    });
    // Force-deselect if another user locked/sold it
    if (status === "locked" || status === "sold") {
      setSelected((prev) => {
        if (!prev.has(seat_id)) return prev;
        const next = new Set(prev);
        next.delete(seat_id);
        return next;
      });
    }
  }, []);

  useWebSocket(event?.id, handleWsMessage);

  function toggleSeat(seatId) {
    const seat = seatMap[seatId];
    if (!seat || seat.status === "locked" || seat.status === "sold") return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seatId)) {
        next.delete(seatId);
      } else {
        if (next.size >= MAX_SEATS) return prev;
        next.add(seatId);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  // Group by section → row_label → seats
  const sectionGroups = sections.map((sec) => {
    const seats = Object.values(seatMap).filter((s) => s.sectionId === sec.id);
    const rows = new Map();
    seats.forEach((s) => {
      const row = s.row_label ?? String(s.row_number);
      if (!rows.has(row)) rows.set(row, []);
      rows.get(row).push(s);
    });
    // Sort each row's seats by seat_number
    rows.forEach((rowSeats) =>
      rowSeats.sort((a, b) => a.seat_number - b.seat_number),
    );
    const sortedRows = Array.from(rows.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return { sec, sortedRows };
  });

  return (
    <div>
      <div className="stage">SÂN KHẤU</div>

      {sectionGroups.map(({ sec, sortedRows }) => (
        <div key={sec.id} className="section-block">
          <div className="section-header">
            <span className="section-name">{sec.name}</span>
            <span className="section-price">{fmtVND(sec.price)}</span>
          </div>

          <div className="seat-map-wrap">
            {sortedRows.map(([rowLabel, rowSeats]) => (
              <div key={rowLabel} className="seat-row">
                <span className="row-label">{rowLabel}</span>
                {rowSeats.map((seat) => {
                  const isSelected = selected.has(seat.id);
                  const displayStatus = isSelected ? "selected" : seat.status;
                  return (
                    <div
                      key={seat.id}
                      className={`seat seat--${displayStatus}`}
                      title={`${rowLabel}${seat.seat_number} — ${displayStatus}`}
                      onClick={() => toggleSeat(seat.id)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="seat-legend">
        {[
          { status: "available", label: "Còn trống", cls: "seat--available" },
          { status: "selected", label: "Đang chọn", cls: "seat--selected" },
          { status: "locked", label: "Đang giữ", cls: "seat--locked" },
          { status: "sold", label: "Đã bán", cls: "seat--sold" },
        ].map(({ label, cls }) => (
          <div key={cls} className="legend-item">
            <div className={`legend-dot seat ${cls}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
