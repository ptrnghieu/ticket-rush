import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiCreateOrder, apiPayOrder, apiCancelOrder } from "../services/api";
import { fmtVND, fmtDate } from "../utils/format";

export default function Checkout() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const { event, seats = [], total = 0, seatIds = [] } = state ?? {};

  const [step, setStep] = useState("review"); // review | paying | success | error
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  if (!event || !seats.length) {
    return (
      <div className="container" style={{ padding: "var(--sp-8)" }}>
        <div className="alert alert-error">
          Không có thông tin đặt vé.{" "}
          <a
            href="/"
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 8 }}
          >
            Về trang chủ
          </a>
        </div>
      </div>
    );
  }

  async function handlePay() {
    setStep("paying");
    setError("");
    try {
      const o = await apiCreateOrder(seatIds);
      const paid = await apiPayOrder(o.id);
      setOrder(paid);
      setStep("success");
    } catch (err) {
      setError(
        err.response?.data?.detail ?? "Thanh toán thất bại. Vui lòng thử lại.",
      );
      setStep("error");
    }
  }

  async function handleCancel() {
    if (!order) {
      navigate(`/events/${event.id}`);
      return;
    }
    setCancelling(true);
    try {
      await apiCancelOrder(order.id);
    } catch {
      /* already released */
    }
    navigate(`/events/${event.id}`);
  }

  if (step === "success") {
    return (
      <div style={{ textAlign: "center", padding: "var(--sp-16) var(--sp-6)" }}>
        <div style={{ fontSize: "4rem", marginBottom: "var(--sp-4)" }}>🎉</div>
        <h1
          style={{
            fontSize: "var(--text-2xl)",
            fontWeight: 800,
            marginBottom: "var(--sp-3)",
          }}
        >
          Đặt vé thành công!
        </h1>
        <p style={{ color: "var(--text-2)", marginBottom: "var(--sp-8)" }}>
          Mã đơn hàng #{order?.id}. Vé đã được gửi vào tài khoản của bạn.
        </p>
        <div
          style={{
            display: "flex",
            gap: "var(--sp-3)",
            justifyContent: "center",
          }}
        >
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate("/my-tickets")}
          >
            Xem vé của tôi
          </button>
          <button
            className="btn btn-ghost btn-lg"
            onClick={() => navigate("/")}
          >
            Trang chủ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="container"
      style={{ padding: "var(--sp-8) var(--sp-6)", maxWidth: 640 }}
    >
      <h1
        style={{
          fontSize: "var(--text-2xl)",
          fontWeight: 800,
          marginBottom: "var(--sp-6)",
        }}
      >
        Xác nhận đặt vé
      </h1>

      {/* Event info */}
      <div className="card" style={{ marginBottom: "var(--sp-4)" }}>
        <h2 style={{ fontWeight: 700, marginBottom: "var(--sp-2)" }}>
          {event.name}
        </h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-3)" }}>
          {fmtDate(event.start_time)} · {event.venue?.name}
        </p>
      </div>

      {/* Order summary */}
      <div className="checkout-summary" style={{ marginBottom: "var(--sp-6)" }}>
        <h3 style={{ fontWeight: 700, marginBottom: "var(--sp-3)" }}>
          Chi tiết đơn hàng
        </h3>
        {seats.map((seat) => (
          <div key={seat.id} className="checkout-row">
            <span>
              Ghế {seat.row_label ?? seat.row_number}
              {seat.seat_number} — {seat.sectionName}
            </span>
            <span>{fmtVND(seat.price)}</span>
          </div>
        ))}
        <div className="checkout-row">
          <span style={{ fontWeight: 700 }}>Tổng cộng</span>
          <span className="checkout-total">{fmtVND(total)}</span>
        </div>
      </div>

      {/* Payment note */}
      <div className="alert alert-info" style={{ marginBottom: "var(--sp-6)" }}>
        Thanh toán demo — không yêu cầu thông tin thẻ thật.
      </div>

      {step === "error" && (
        <div
          className="alert alert-error"
          style={{ marginBottom: "var(--sp-4)" }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--sp-3)" }}>
        <button
          className="btn btn-primary btn-lg"
          style={{ flex: 1 }}
          onClick={handlePay}
          disabled={step === "paying"}
        >
          {step === "paying" ? (
            <>
              <span
                className="spinner"
                style={{ width: 16, height: 16, borderWidth: 2 }}
              />{" "}
              Đang xử lý...
            </>
          ) : (
            `Thanh toán ${fmtVND(total)}`
          )}
        </button>
        <button
          className="btn btn-ghost btn-lg"
          onClick={handleCancel}
          disabled={cancelling || step === "paying"}
        >
          Hủy
        </button>
      </div>

      <p
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-3)",
          marginTop: "var(--sp-3)",
          textAlign: "center",
        }}
      >
        Ghế sẽ được giữ đến khi thanh toán. Hủy sẽ giải phóng ghế cho người
        khác.
      </p>
    </div>
  );
}
