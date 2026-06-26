import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { validateEmail, getDeviceInfo } from '../../utils/helpers';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function EmailLogin() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const navigate = useNavigate();
  // ❌ Remove user check – no redirects from here

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setStatusMessage('Checking your identity...');

    try {
      const checkRes = await api.post('/auth/check-user', { email });
      const { exists } = checkRes.data.data;
      const deviceInfo = getDeviceInfo();

      if (!exists) {
        // New user → OTP
        setStatusMessage('📧 New user! Sending OTP...');
        await api.post('/auth/send-otp', { email });
        toast.success('OTP sent to your email!');
        setTimeout(() => {
          navigate('/login/otp', {
            state: { email, isNewUser: true, deviceInfo },
          });
        }, 500);
      } else {
        // Existing user → Face login
        setStatusMessage('👋 Welcome back! Proceeding to face verification...');
        toast.success('Existing user! Proceed to face verification.');
        setTimeout(() => {
          navigate('/login/face', {
            state: { email, isNewUser: false, deviceInfo },
          });
        }, 500);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Network error. Please try again.';
      setStatusMessage('❌ ' + errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-900 to-gray-800 p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-white/20">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-3xl font-bold text-white">ZEROKEY</h1>
          <p className="text-gray-400 mt-2">Passwordless Authentication</p>
          {statusMessage && (
            <p className="mt-3 text-sm text-blue-300 animate-pulse">{statusMessage}</p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Enter your email"
              required
              autoFocus
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-linear-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </>
            ) : (
              'Continue →'
            )}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          No password needed. Just your face, hand, and gesture.
        </p>
      </div>
    </div>
  );
}