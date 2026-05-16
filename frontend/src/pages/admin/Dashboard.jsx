import { useState, useEffect } from 'react';
import {
  apiAdminListEvents,
  apiAdminDashboard,
  apiAdminAnalytics,
  apiAdminQueueStatus,
  apiAdminActivateQueue,
  apiAdminDeactivateQueue,
} from '../../services/api';
import { fmtVND } from '../../utils/format';

function BarRow({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 'var(--sp-2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color: 'var(--text-3)' }}>{value} ({pct}%)</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width .4s' }} />
      </div>
    </div>
  );
}

const GENDER_LABELS = { male: 'Nam', female: 'Nữ', other: 'Khác', unknown: 'Không rõ' };
const GENDER_COLORS = { male: 'var(--info)', female: '#f472b6', other: 'var(--accent)', unknown: 'var(--text-3)' };
const AGE_LABELS = { under_18: 'Dưới 18', '18_25': '18–25', '26_35': '26–35', '36_50': '36–50', over_50: 'Trên 50' };
const AGE_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa'];

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [queueLoading, setQueueLoading] = useState(false);

  useEffect(() => {
    apiAdminListEvents({ limit: 200 })
      .then(e => {
        setEvents(e);
        if (e.length) setSelectedId(String(e[0].id));
      })
      .catch(() => setError('Không thể tải danh sách sự kiện'));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setDashboard(null);
    setAnalytics(null);
    setQueueStatus(null);
    Promise.all([
      apiAdminDashboard(selectedId).catch(() => null),
      apiAdminAnalytics(selectedId).catch(() => null),
      apiAdminQueueStatus(selectedId).catch(() => null),
    ]).then(([dash, ana, q]) => {
      setDashboard(dash);
      setAnalytics(ana);
      setQueueStatus(q);
    }).finally(() => setLoading(false));
  }, [selectedId]);

  async function toggleQueue() {
    if (!selectedId || !queueStatus) return;
    setQueueLoading(true);
    try {
      if (queueStatus.queue_active) {
        await apiAdminDeactivateQueue(selectedId);
      } else {
        await apiAdminActivateQueue(selectedId);
      }
      const q = await apiAdminQueueStatus(selectedId);
      setQueueStatus(q);
    } catch { /* ignore */ }
    setQueueLoading(false);
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-6)' }}>
        <h1 className="admin-page-title" style={{ margin: 0 }}>Dashboard</h1>
        <select
          className="select"
          style={{ width: 280 }}
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
        >
          {events.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <div className="spinner-wrap"><div className="spinner" /></div>}

      {dashboard && !loading && (
        <>
          {/* Key stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <p className="stat-label">Tổng doanh thu</p>
              <p className="stat-value accent">{fmtVND(dashboard.total_revenue)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Tỉ lệ lấp đầy</p>
              <p className="stat-value green">{dashboard.occupancy_rate}%</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Ghế đã bán</p>
              <p className="stat-value">{dashboard.sold_seats} / {dashboard.total_seats}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Đang giữ chỗ</p>
              <p className="stat-value blue">{dashboard.locked_seats}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Còn trống</p>
              <p className="stat-value">{dashboard.available_seats}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Lượt yêu thích</p>
              <p className="stat-value" style={{ color: '#f87171' }}>♥ {dashboard.favorite_count ?? 0}</p>
            </div>
          </div>

          {/* Occupancy bar */}
          <div className="card" style={{ marginBottom: 'var(--sp-6)' }}>
            <h3 style={{ marginBottom: 'var(--sp-4)', fontWeight: 700 }}>Sơ đồ lấp đầy ghế</h3>
            <div style={{ display: 'flex', height: 24, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
              <div style={{ flex: dashboard.sold_seats, background: 'var(--success)', minWidth: dashboard.sold_seats ? 4 : 0 }} title={`Đã bán: ${dashboard.sold_seats}`} />
              <div style={{ flex: dashboard.locked_seats, background: 'var(--info)', minWidth: dashboard.locked_seats ? 4 : 0 }} title={`Đang giữ: ${dashboard.locked_seats}`} />
              <div style={{ flex: dashboard.available_seats, background: 'var(--bg-elevated)', minWidth: 4 }} title={`Còn trống: ${dashboard.available_seats}`} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-2)', fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
              <span style={{ color: 'var(--success)' }}>■ Đã bán</span>
              <span style={{ color: 'var(--info)' }}>■ Đang giữ</span>
              <span>■ Còn trống</span>
            </div>
          </div>
        </>
      )}

      {/* Audience analytics */}
      {analytics && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-6)', marginBottom: 'var(--sp-6)' }}>
          {/* Gender breakdown */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
              <h3 style={{ fontWeight: 700 }}>Giới tính khách mua</h3>
              <span className="badge badge-gray">{analytics.total_buyers} người</span>
            </div>
            {analytics.total_buyers === 0 ? (
              <p style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>Chưa có dữ liệu</p>
            ) : (
              Object.entries(analytics.gender_breakdown).map(([key, val]) => (
                <BarRow
                  key={key}
                  label={GENDER_LABELS[key] ?? key}
                  value={val}
                  total={analytics.total_buyers}
                  color={GENDER_COLORS[key] ?? 'var(--accent)'}
                />
              ))
            )}
          </div>

          {/* Age groups */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
              <h3 style={{ fontWeight: 700 }}>Độ tuổi khách mua</h3>
              <span className="badge badge-gray">{analytics.total_buyers} người</span>
            </div>
            {analytics.total_buyers === 0 ? (
              <p style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>Chưa có dữ liệu</p>
            ) : (
              Object.entries(analytics.age_groups).map(([key, val], i) => (
                <BarRow
                  key={key}
                  label={AGE_LABELS[key] ?? key}
                  value={val}
                  total={analytics.total_buyers}
                  color={AGE_COLORS[i % AGE_COLORS.length]}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Queue control */}
      {queueStatus && !loading && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontWeight: 700, marginBottom: 'var(--sp-1)' }}>Hàng đợi ảo</h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
                Trạng thái:{' '}
                <span className={`badge ${queueStatus.queue_active ? 'badge-green' : 'badge-gray'}`}>
                  {queueStatus.queue_active ? 'Đang hoạt động' : 'Tắt'}
                </span>
                {' · '}
                {queueStatus.waiting_count} người đang chờ
              </p>
            </div>
            <button
              className={`btn ${queueStatus.queue_active ? 'btn-danger' : 'btn-primary'}`}
              onClick={toggleQueue}
              disabled={queueLoading}
            >
              {queueLoading ? '...' : queueStatus.queue_active ? 'Tắt hàng đợi' : 'Bật hàng đợi'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
