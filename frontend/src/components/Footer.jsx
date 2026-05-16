import { NavLink } from 'react-router-dom';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="footer-logo">Ticket<span>Rush</span></span>
          <p className="footer-tagline">Mua vé nhanh, đặt chỗ dễ dàng.</p>
        </div>

        <div className="footer-cols">
          <div className="footer-col">
            <p className="footer-col-title">Khám phá</p>
            <NavLink to="/" className="footer-link">Tất cả sự kiện</NavLink>
            <NavLink to="/?type=concert" className="footer-link">Hòa nhạc</NavLink>
            <NavLink to="/?type=festival" className="footer-link">Lễ hội</NavLink>
            <NavLink to="/?type=sports" className="footer-link">Thể thao</NavLink>
          </div>
          <div className="footer-col">
            <p className="footer-col-title">Tài khoản</p>
            <NavLink to="/my-tickets" className="footer-link">Vé của tôi</NavLink>
            <NavLink to="/favorites" className="footer-link">Yêu thích</NavLink>
            <NavLink to="/login" className="footer-link">Đăng nhập</NavLink>
            <NavLink to="/register" className="footer-link">Đăng ký</NavLink>
          </div>
          <div className="footer-col">
            <p className="footer-col-title">Hỗ trợ</p>
            <span className="footer-link">Điều khoản sử dụng</span>
            <span className="footer-link">Chính sách bảo mật</span>
            <span className="footer-link">Liên hệ</span>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          <p>© {year} TicketRush. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
