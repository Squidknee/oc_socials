import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';

// Wrap any route element in <RequireAuth> to redirect logged-out users to /login.
export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p style={{ padding: '1rem' }}>Loading…</p>;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
