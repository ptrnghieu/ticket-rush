import axios from "axios";

const BASE = "/api/v1";

const http = axios.create({ baseURL: BASE });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("tr_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("tr_token");
      localStorage.removeItem("tr_user");
      if (
        !window.location.pathname.includes("/login") &&
        !window.location.pathname.includes("/register")
      ) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);

// ── Auth ──────────────────────────────────────────────────────

export async function apiRegister({ email, password, full_name, age, gender }) {
  const { data } = await http.post("/auth/register", {
    email,
    password,
    full_name,
    age,
    gender,
  });
  return data; // UserResponse
}

export async function apiLogin({ email, password }) {
  // FastAPI OAuth2PasswordRequestForm requires form-encoded body
  const body = new URLSearchParams({ username: email, password });
  const { data } = await http.post("/auth/login", body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data; // Token: { access_token, token_type, user_id, role }
}

// ── Events ────────────────────────────────────────────────────

export async function apiListEvents({ skip = 0, limit = 20, event_type } = {}) {
  const params = { skip, limit };
  if (event_type) params.event_type = event_type;
  const { data } = await http.get("/events", { params });
  return data;
}

export async function apiGetEvent(eventId) {
  const { data } = await http.get(`/events/${eventId}`);
  return data;
}

// ── Seats ─────────────────────────────────────────────────────

export async function apiGetSeatMatrix(sectionId) {
  const { data } = await http.get(`/seats/${sectionId}`);
  return data; // { section_id, seats, available_count, total_count }
}

export async function apiLockSeats(seatIds) {
  const { data } = await http.post("/seats/lock", { seat_ids: seatIds });
  return data; // [LockResponse]
}

export async function apiReleaseLock(seatId) {
  await http.delete(`/seats/${seatId}/lock`);
}

// ── Orders ────────────────────────────────────────────────────

export async function apiListOrders() {
  const { data } = await http.get("/orders");
  return data;
}

export async function apiCreateOrder(seatIds) {
  const { data } = await http.post("/orders", { seat_ids: seatIds });
  return data;
}

export async function apiPayOrder(orderId, paymentMethod = "mock") {
  const { data } = await http.post(`/orders/${orderId}/pay`, {
    payment_method: paymentMethod,
  });
  return data;
}

export async function apiCancelOrder(orderId) {
  await http.delete(`/orders/${orderId}`);
}

// ── Tickets ───────────────────────────────────────────────────

export async function apiMyTickets() {
  const { data } = await http.get("/tickets");
  return data;
}

// ── Queue ─────────────────────────────────────────────────────

export async function apiJoinQueue(eventId) {
  const { data } = await http.post(`/queue/join/${eventId}`);
  return data;
}

export async function apiQueueStatus(eventId) {
  const { data } = await http.get(`/queue/status/${eventId}`);
  return data;
}

export async function apiLeaveQueue(eventId) {
  await http.delete(`/queue/leave/${eventId}`);
}

export async function apiCheckAdmission(eventId, token) {
  const { data } = await http.get(`/queue/check/${eventId}/${token}`);
  return data; // { admitted: bool, event_id }
}

// ── Admin ─────────────────────────────────────────────────────

export async function apiAdminListEvents({ skip = 0, limit = 50 } = {}) {
  const { data } = await http.get("/admin/events", { params: { skip, limit } });
  return data;
}

export async function apiAdminCreateEvent(payload) {
  const { data } = await http.post("/admin/events", payload);
  return data;
}

export async function apiAdminUpdateEvent(eventId, payload) {
  const { data } = await http.put(`/admin/events/${eventId}`, payload);
  return data;
}

export async function apiAdminUpdateEventStatus(eventId, status) {
  const { data } = await http.patch(`/admin/events/${eventId}/status`, {
    status,
  });
  return data;
}

export async function apiAdminDeleteEvent(eventId) {
  await http.delete(`/admin/events/${eventId}`);
}

export async function apiAdminListVenues() {
  const { data } = await http.get("/admin/venues");
  return data;
}

export async function apiAdminCreateVenue(payload) {
  const { data } = await http.post("/admin/venues", payload);
  return data;
}

export async function apiAdminAddSection(eventId, payload) {
  const { data } = await http.post(
    `/admin/events/${eventId}/sections`,
    payload,
  );
  return data;
}

export async function apiAdminGenerateSeats(sectionId) {
  const { data } = await http.post(`/admin/sections/${sectionId}/seats`);
  return data;
}

export async function apiAdminDashboard(eventId) {
  const { data } = await http.get(`/admin/dashboard/${eventId}`);
  return data;
}

export async function apiAdminAnalytics(eventId) {
  const { data } = await http.get(`/admin/analytics/${eventId}`);
  return data;
}

export async function apiAdminActivateQueue(eventId) {
  const { data } = await http.post(`/admin/events/${eventId}/queue/activate`);
  return data;
}

export async function apiAdminDeactivateQueue(eventId) {
  const { data } = await http.post(`/admin/events/${eventId}/queue/deactivate`);
  return data;
}

export async function apiAdminQueueStatus(eventId) {
  const { data } = await http.get(`/admin/events/${eventId}/queue/status`);
  return data;
}

export default http;
