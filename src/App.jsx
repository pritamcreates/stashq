import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { useStore } from './store/useStore';
import SignIn from './pages/SignIn/SignIn';
import Dashboard from './pages/Dashboard/Dashboard';
import ShootDay from './pages/ShootDay/ShootDay';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  const { setUser, setAuthReady } = useStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) setAuthReady();
    });
    return unsub;
  }, [setUser, setAuthReady]);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="/shoot-day" element={
          <ProtectedRoute><ShootDay /></ProtectedRoute>
        } />
        {/* Redirect any unknown path to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
