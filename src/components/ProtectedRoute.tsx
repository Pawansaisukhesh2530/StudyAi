import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();

  if (!configured) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="card empty-state-card">
          <div className="empty-state">
            <p>Checking authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
