import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminBar.css';

const AdminBar = () => {
  const { user } = useAuth();
  const location = useLocation();
  if (!user?.isAdmin) return null;
  const isOnAdmin = location.pathname.startsWith('/admin');
  return (
    <div className="admin-bar">
      <div className="admin-bar-inner">
        <div className="ab-left">
          <span>👑</span>
          <span className="ab-text">Admin Mode</span>
          <span className="ab-name">{user.name}</span>
        </div>
        <div className="ab-right">
          {isOnAdmin ? (
            <Link to="/" className="ab-btn ab-store">← Back to Store</Link>
          ) : (
            <Link to="/admin" className="ab-btn ab-admin">Admin Dashboard →</Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminBar;
