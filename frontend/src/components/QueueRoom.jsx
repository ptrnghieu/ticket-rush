import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiQueueStatus, apiLeaveQueue } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

export default function QueueRoom({ event }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [admitted, setAdmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiQueueStatus(event.id)
      .then(setSession)
      .catch(() => setError('Không thể lấy vị trí hàng đợi'))
      .finally(() => setLoading(false));
  }, [event.id]);

  // Poll every 30s as fallback
  useEffect(() => {
    const id = setInterval(() => {
      apiQueueStatus(event.id).then(setSession).catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, [event.id]);

  const handleWsMessage = useCallback((msg) => {
    if (msg.type === 'queue_position_updated') {
      setSession(prev => prev ? { ...prev, queue_size: msg.queue_size } : prev);
    }
    if (msg.type === 'queue_admitted') {
      setAdmitted(true);
    }
  }, []);

  useWebSocket(event.id, handleWsMessage);

  async function handleLeave() {
    await apiLeaveQueue(event.id);
    navigate('/');
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner spinner-lg" /></div>;
  if (error)   return <div className="alert alert-error">{error}</div>;

  if (admitted || session?.status === 'admitted') {
    return (
      <div className="queue-room">
        <div style={{ fontSize: '4rem' }}>🎉</div>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>Bạn đã được vào!</h2>
        <p className="queue-label">Bạn có <strong>10 phút</strong> để chọn ghế</p>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => navigate(`/events/${event.id}?admitted=1`)}
        >
          Chọn ghế ngay →
        </button>
      </div>
    );
  }

  const pos = session?.position ?? '—';
  const queueSize = session?.queue_size ?? '—';
  const wait = session?.estimated_wait_minutes;

  return (
    <div className="queue-room">
      <p style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>Vị trí của bạn</p>
      <div className="queue-position">{pos}</div>
      <p className="queue-label">trong tổng số <strong>{queueSize}</strong> người chờ</p>

      {typeof wait === 'number' && (
        <p className="queue-wait">
          Ước tính: ~{wait} phút
        </p>
      )}

      {queueSize > 0 && typeof pos === 'number' && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${Math.max(5, 100 - (pos / queueSize) * 100)}%` }}
          />
        </div>
      )}

      <p style={{ color: 'var(--text-3)', fontSize: 'var(--text-xs)' }}>
        Hàng đợi tự động cập nhật. Vui lòng không đóng trang này.
      </p>

      <button className="btn btn-ghost btn-sm" onClick={handleLeave}>
        Rời hàng đợi
      </button>
    </div>
  );
}
