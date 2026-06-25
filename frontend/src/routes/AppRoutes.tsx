import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  EmailLogin, 
  OTPVerification, 
  FaceLogin, 
  HandLogin, 
  GestureChallenge 
} from '../Components/Login';

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) return <div className="text-white flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <Routes>
      {/* Public Routes - Login Flow */}
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <EmailLogin />} />
      <Route path="/login/otp" element={user ? <Navigate to="/dashboard" /> : <OTPVerification />} />
      <Route path="/login/face" element={user ? <Navigate to="/dashboard" /> : <FaceLogin />} />
      <Route path="/login/hand" element={user ? <Navigate to="/dashboard" /> : <HandLogin />} />
      <Route path="/login/gesture" element={user ? <Navigate to="/dashboard" /> : <GestureChallenge />} />

      {/* Dashboard - Protected */}
      <Route path="/dashboard" element={user ? <div>Dashboard</div> : <Navigate to="/" />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default AppRoutes;