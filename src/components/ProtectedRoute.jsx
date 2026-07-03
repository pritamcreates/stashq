import { Navigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

export default function ProtectedRoute({ children }) {
  const { user, authReady } = useStore();

  if (!authReady) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#f2f2f0',
        fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: '#aaa',
      }}>
        Loading…
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  return children;
}
