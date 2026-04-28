import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: '', email: '', password: '', age: '', gender: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender || undefined,
      });
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(Array.isArray(detail) ? detail[0]?.msg : (detail ?? 'Đăng ký thất bại'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">TicketRush</div>
        <h1 className="auth-title">Tạo tài khoản</h1>
        <p className="auth-sub">Tham gia để mua vé ngay hôm nay</p>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--sp-4)' }}>{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="full_name">Họ và tên</label>
            <input
              id="full_name" name="full_name" type="text"
              className="input" placeholder="Nguyễn Văn A"
              value={form.full_name} onChange={handleChange}
              required autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email" name="email" type="email"
              className="input" placeholder="email@example.com"
              value={form.email} onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Mật khẩu</label>
            <input
              id="password" name="password" type="password"
              className="input" placeholder="Ít nhất 8 ký tự"
              value={form.password} onChange={handleChange}
              minLength={8} required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="age">Tuổi</label>
              <input
                id="age" name="age" type="number"
                className="input" placeholder="25"
                min={1} max={120}
                value={form.age} onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="gender">Giới tính</label>
              <select id="gender" name="gender" className="select" value={form.gender} onChange={handleChange}>
                <option value="">— Chọn —</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Đăng ký'}
          </button>
        </form>

        <p className="auth-footer">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
