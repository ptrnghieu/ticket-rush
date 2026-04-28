import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  apiAdminListEvents, apiAdminUpdateEventStatus, apiAdminDeleteEvent
} from '../../services/api';
import { fmtDate, statusLabel, statusBadgeClass } from '../../utils/format';

const STATUS_TRANSITIONS = {
  draft:     ['published'],
  published: ['on_sale', 'draft'],
  on_sale:   ['ended'],
  ended:     [],
};

export default function Events() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);

  function load() {
    setLoading(true);
    apiAdminListEvents({ limit: 200 })
      .then(setEvents)
      .catch(() => setError('Không thể tải danh sách sự kiện'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleStatusChange(event, newStatus) {
    setActionId(event.id);
    try {
      await apiAdminUpdateEventStatus(event.id, newStatus);
      load();
    } catch (err) {
      alert(err.response?.data?.detail ?? 'Không thể cập nhật trạng thái');
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(event) {
    if (!confirm(`Xóa sự kiện "${event.name}"?`)) return;
    setActionId(event.id);
    try {
      await apiAdminDeleteEvent(event.id);
      setEvents(prev => prev.filter(e => e.id !== event.id));
    } catch (err) {
      alert(err.response?.data?.detail ?? 'Không thể xóa sự kiện');
    } finally {
      setActionId(null);
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-6)' }}>
        <h1 className="admin-page-title" style={{ margin: 0 }}>Quản lý sự kiện</h1>
        <button className="btn btn-primary" onClick={() => navigate('/admin/events/create')}>
          + Tạo sự kiện
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 'var(--sp-4)' }}>{error}</div>}
      {loading && <div className="spinner-wrap"><div className="spinner" /></div>}

      {!loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tên sự kiện</th>
                <th>Địa điểm</th>
                <th>Thời gian</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)' }}>Chưa có sự kiện nào</td></tr>
              )}
              {events.map(event => {
                const transitions = STATUS_TRANSITIONS[event.status] ?? [];
                const busy = actionId === event.id;
                return (
                  <tr key={event.id}>
                    <td style={{ color: 'var(--text-1)', fontWeight: 500, maxWidth: 200 }}>
                      {event.name}
                    </td>
                    <td>{event.venue?.name ?? '—'}</td>
                    <td>{fmtDate(event.start_time)}</td>
                    <td>
                      <span className={`badge ${statusBadgeClass(event.status)}`}>
                        {statusLabel(event.status)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                        {transitions.map(s => (
                          <button
                            key={s}
                            className="btn btn-ghost btn-sm"
                            disabled={busy}
                            onClick={() => handleStatusChange(event, s)}
                          >
                            → {statusLabel(s)}
                          </button>
                        ))}
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={busy}
                          onClick={() => handleDelete(event)}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
