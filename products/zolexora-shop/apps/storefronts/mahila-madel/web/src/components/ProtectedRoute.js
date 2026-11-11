import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Guard = ({ children, admin = false }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && !user.isAdmin) return <Navigate to="/" replace />;
  return children;
};

export const ProtectedRoute = ({ children }) => <Guard>{children}</Guard>;
export const AdminRoute = ({ children }) => <Guard admin>{children}</Guard>;
