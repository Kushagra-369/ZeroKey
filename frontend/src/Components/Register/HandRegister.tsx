import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function HandRegister() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      navigate('/');
      return;
    }
  }, [email, navigate]);

  const handleComplete = () => {
    // TODO: Complete registration
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-white/20 text-center">
        <div className="text-4xl mb-4">🤚</div>
        <h2 className="text-2xl font-bold text-white">Hand Registration</h2>
        <p className="text-gray-400 text-sm mt-2">New user: {email}</p>
        <div className="mt-6 text-yellow-400">🟡 Hand registration coming soon...</div>
        <button
          onClick={handleComplete}
          className="mt-6 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          Complete Registration →
        </button>
      </div>
    </div>
  );
}