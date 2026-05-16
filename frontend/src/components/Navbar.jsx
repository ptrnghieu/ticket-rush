import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header className="nav">
      <div className="container nav-inner">
        <NavLink to="/" className="nav-logo">
          Ticket<span style={{ color: 'var(--text-1)' }}>Rush</span>
        </NavLink>

        <nav className="nav-links">
          <NavLink to="/" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            Sự kiện
          </NavLink>

          {user ? (
            <>
              {isAdmin ? (
                <NavLink to="/admin" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
                  Dashboard
                </NavLink>
              ) : (
                <>
                  <NavLink to="/favorites" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
                    ♥ Yêu thích
                  </NavLink>
                  <NavLink to="/my-tickets" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
                    Vé của tôi
                  </NavLink>
                </>
              )}
              <div className="nav-divider" />
              <span className="nav-user">{user.email}</span>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="btn btn-ghost btn-sm">Đăng nhập</NavLink>
              <NavLink to="/register" className="btn btn-primary btn-sm">Đăng ký</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
