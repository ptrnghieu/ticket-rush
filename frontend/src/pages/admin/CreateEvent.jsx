import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  apiAdminListVenues,
  apiAdminCreateVenue,
  apiAdminCreateEvent,
  apiAdminAddSection,
  apiAdminGenerateSeats,
} from "../../services/api";

const EMPTY_SECTION = { name: "", price: "", row_count: "", col_count: "" };

const EVENT_TYPES = [
  { value: "concert", label: "Hòa nhạc" },
  { value: "festival", label: "Lễ hội" },
  { value: "theater", label: "Sân khấu" },
  { value: "sports", label: "Thể thao" },
  { value: "conference", label: "Hội thảo" },
  { value: "cinema", label: "Điện ảnh" },
  { value: "comedy", label: "Hài kịch" },
  { value: "other", label: "Khác" },
];

export default function CreateEvent() {
  const navigate = useNavigate();

  const [venues, setVenues] = useState([]);
  const [form, setForm] = useState({
    venue_id: "",
    name: "",
    description: "",
    start_time: "",
    end_time: "",
    poster_url: "",
    event_type: "other",
  });
  const [sections, setSections] = useState([{ ...EMPTY_SECTION }]);
  const [newVenueName, setNewVenueName] = useState("");
  const [newVenueAddress, setNewVenueAddress] = useState("");
  const [showNewVenue, setShowNewVenue] = useState(false);

  const [step, setStep] = useState("form"); // form | saving | done
  const [error, setError] = useState("");

  useEffect(() => {
    apiAdminListVenues()
      .then(setVenues)
      .catch(() => {});
  }, []);

  function handleFormChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleSectionChange(i, field, value) {
    setSections((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  }

  function addSection() {
    setSections((prev) => [...prev, { ...EMPTY_SECTION }]);
  }

  function removeSection(i) {
    setSections((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setStep("saving");

    try {
      let venueId = form.venue_id;

      // Create venue if needed
      if (showNewVenue && newVenueName) {
        const venue = await apiAdminCreateVenue({
          name: newVenueName,
          location: newVenueAddress || undefined,
        });
        venueId = venue.id;
      }

      if (!venueId) {
        setError("Vui lòng chọn hoặc tạo địa điểm");
        setStep("form");
        return;
      }

      // Create event
      const event = await apiAdminCreateEvent({
        venue_id: Number(venueId),
        name: form.name,
        description: form.description,
        start_time: new Date(form.start_time).toISOString(),
        end_time: form.end_time
          ? new Date(form.end_time).toISOString()
          : undefined,
        poster_url: form.poster_url || undefined,
        event_type: form.event_type || "other",
      });

      // Create sections + generate seats
      for (const sec of sections) {
        if (!sec.name || !sec.price || !sec.row_count || !sec.col_count)
          continue;
        const section = await apiAdminAddSection(event.id, {
          name: sec.name,
          price: Number(sec.price),
          row_count: Number(sec.row_count),
          col_count: Number(sec.col_count),
        });
        await apiAdminGenerateSeats(section.id);
      }

      setStep("done");
      setTimeout(() => navigate("/admin/events"), 1500);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        Array.isArray(detail)
          ? detail[0]?.msg
          : (detail ?? "Tạo sự kiện thất bại"),
      );
      setStep("form");
    }
  }

  if (step === "done") {
    return (
      <div style={{ textAlign: "center", padding: "var(--sp-12)" }}>
        <div style={{ fontSize: "3rem", marginBottom: "var(--sp-3)" }}>✅</div>
        <h2>Tạo sự kiện thành công!</h2>
        <p style={{ color: "var(--text-3)" }}>Đang chuyển hướng...</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="admin-page-title">Tạo sự kiện mới</h1>

      {error && (
        <div
          className="alert alert-error"
          style={{ marginBottom: "var(--sp-4)" }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: "var(--sp-6)" }}>
          <h3 style={{ fontWeight: 700, marginBottom: "var(--sp-4)" }}>
            Thông tin sự kiện
          </h3>

          <div style={{ display: "grid", gap: "var(--sp-4)" }}>
            <div className="form-group">
              <label className="form-label">Tên sự kiện *</label>
              <input
                name="name"
                className="input"
                required
                value={form.name}
                onChange={handleFormChange}
                placeholder="VD: Coldplay Concert 2025"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mô tả</label>
              <textarea
                name="description"
                className="input"
                rows={3}
                value={form.description}
                onChange={handleFormChange}
                placeholder="Mô tả chi tiết sự kiện..."
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--sp-4)",
              }}
            >
              <div className="form-group">
                <label className="form-label">Thời gian bắt đầu *</label>
                <input
                  name="start_time"
                  type="datetime-local"
                  className="input"
                  required
                  value={form.start_time}
                  onChange={handleFormChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Thời gian kết thúc</label>
                <input
                  name="end_time"
                  type="datetime-local"
                  className="input"
                  value={form.end_time}
                  onChange={handleFormChange}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--sp-4)",
              }}
            >
              <div className="form-group">
                <label className="form-label">URL poster</label>
                <input
                  name="poster_url"
                  type="url"
                  className="input"
                  value={form.poster_url}
                  onChange={handleFormChange}
                  placeholder="https://..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Loại sự kiện</label>
                <select
                  name="event_type"
                  className="select"
                  value={form.event_type}
                  onChange={handleFormChange}
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Venue */}
        <div className="card" style={{ marginBottom: "var(--sp-6)" }}>
          <h3 style={{ fontWeight: 700, marginBottom: "var(--sp-4)" }}>
            Địa điểm
          </h3>

          {!showNewVenue ? (
            <div
              style={{
                display: "flex",
                gap: "var(--sp-3)",
                alignItems: "flex-end",
              }}
            >
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Chọn địa điểm</label>
                <select
                  name="venue_id"
                  className="select"
                  value={form.venue_id}
                  onChange={handleFormChange}
                >
                  <option value="">— Chọn địa điểm —</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowNewVenue(true)}
              >
                + Tạo mới
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "var(--sp-3)" }}>
              <div className="form-group">
                <label className="form-label">Tên địa điểm *</label>
                <input
                  className="input"
                  value={newVenueName}
                  onChange={(e) => setNewVenueName(e.target.value)}
                  placeholder="VD: Nhà hát lớn Hà Nội"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Địa chỉ</label>
                <input
                  className="input"
                  value={newVenueAddress}
                  onChange={(e) => setNewVenueAddress(e.target.value)}
                  placeholder="Số nhà, đường, quận, thành phố"
                />
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowNewVenue(false)}
              >
                ← Chọn địa điểm có sẵn
              </button>
            </div>
          )}
        </div>

        {/* Sections */}
        <div className="card" style={{ marginBottom: "var(--sp-6)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "var(--sp-4)",
            }}
          >
            <h3 style={{ fontWeight: 700 }}>Khu vực ghế</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={addSection}
            >
              + Thêm khu vực
            </button>
          </div>

          {sections.map((sec, i) => (
            <div
              key={i}
              style={{
                background: "var(--bg-elevated)",
                borderRadius: "var(--radius)",
                padding: "var(--sp-4)",
                marginBottom: "var(--sp-3)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                  gap: "var(--sp-3)",
                  alignItems: "end",
                }}
              >
                <div className="form-group">
                  <label className="form-label">Tên khu vực</label>
                  <input
                    className="input"
                    value={sec.name}
                    onChange={(e) =>
                      handleSectionChange(i, "name", e.target.value)
                    }
                    placeholder="VD: Hạng VIP"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Giá (VND)</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={sec.price}
                    onChange={(e) =>
                      handleSectionChange(i, "price", e.target.value)
                    }
                    placeholder="500000"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Số hàng</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={100}
                    value={sec.row_count}
                    onChange={(e) =>
                      handleSectionChange(i, "row_count", e.target.value)
                    }
                    placeholder="10"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Ghế/hàng</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={100}
                    value={sec.col_count}
                    onChange={(e) =>
                      handleSectionChange(i, "col_count", e.target.value)
                    }
                    placeholder="20"
                  />
                </div>
                {sections.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeSection(i)}
                  >
                    ✕
                  </button>
                )}
              </div>
              {sec.row_count && sec.col_count && (
                <p
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-3)",
                    marginTop: "var(--sp-2)",
                  }}
                >
                  {Number(sec.row_count) * Number(sec.col_count)} ghế sẽ được
                  tạo tự động
                </p>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "var(--sp-3)" }}>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={step === "saving"}
          >
            {step === "saving" ? "Đang tạo..." : "Tạo sự kiện"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-lg"
            onClick={() => navigate("/admin/events")}
          >
            Hủy
          </button>
        </div>
      </form>
    </>
  );
}
