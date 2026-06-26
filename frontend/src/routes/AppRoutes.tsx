import { Routes, Route } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  EmailLogin, 
  OTPVerification, 
  FaceLogin, 
  HandLogin, 
  GestureChallenge 
} from '../Components/Login';

const AppRoutes = () => {
  const { loading } = useAuth();

  if (loading) return <div className="text-white flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <Routes>
      {/* Login Flow – No redirects anywhere */}
      <Route path="/" element={<EmailLogin />} />
      <Route path="/login/otp" element={<OTPVerification />} />
      <Route path="/login/face" element={<FaceLogin />} />
      <Route path="/login/hand" element={<HandLogin />} />
      <Route path="/login/gesture" element={<GestureChallenge />} />
      
      {/* Optional: Add other routes like /vault, /profile later */}
      {/* <Route path="/vault" element={<Vault />} /> */}
    </Routes>
  );
};

export default AppRoutes;