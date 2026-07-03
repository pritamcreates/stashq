import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebase';
import { useStore } from '../../store/useStore';
import ShootDayForm from '../../components/ShootDayForm/ShootDayForm';
import Toast from '../../components/Toast/Toast';

export default function ShootDay() {
  const navigate = useNavigate();
  const setUser = useStore(s => s.setUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) navigate('/', { replace: true });
      else setUser(u);
    });
    return unsub;
  }, [navigate, setUser]);

  return (
    <>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ShootDayForm onBack={() => navigate('/dashboard')} />
      </div>
      <Toast />
    </>
  );
}
