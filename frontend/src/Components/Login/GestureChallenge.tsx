import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function GestureChallenge() {
  const [challenge, setChallenge] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  const location = useLocation();
  const navigate = useNavigate();
  const { email } = location.state || {};
  const { login } = useAuth();

  const gestures = ['👆 Swipe Up', '👇 Swipe Down', '👈 Swipe Left', '👉 Swipe Right', '⭕ Circle', '🔺 V-Shape', '📐 ZigZag'];

  useEffect(() => {
    if (!email) {
      navigate('/login');
      return;
    }
    fetchChallenge();
  }, []);

  const fetchChallenge = async () => {
    try {
      const res = await api.get('/biometric/gesture-challenge');
      setChallenge(res.data.data);
      setTimeLeft(res.data.data.timeout || 10);
    } catch (error) {
      toast.error('Failed to load challenge');
    }
  };

  const handleGestureSelect = (gesture: string) => {
    if (!challenge) return;
    
    const expected = challenge.sequence[currentStep];
    if (gesture.includes(expected)) {
      // Correct gesture
      toast.success(`✅ ${expected} correct!`);
      
      if (currentStep + 1 === challenge.sequence.length) {
        // All gestures completed
        verifyChallenge();
      } else {
        setCurrentStep(prev => prev + 1);
      }
    } else {
      toast.error(`❌ Wrong gesture! Expected: ${expected}`);
    }
  };

  const verifyChallenge = async () => {
    setIsVerifying(true);
    try {
      // Verify the challenge
      await api.post('/biometric/gesture/verify', {
        pattern: challenge.sequence.join('-'),
        sequence: challenge.sequence
      });

      toast.success('🎉 All challenges completed!');
      
      // Final login - store session and redirect
      // For demo, using login function
      await login(email, 'dummy-password'); // Backend will handle passwordless
      navigate('/');
      
    } catch (error) {
      toast.error('Challenge verification failed');
      setIsVerifying(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (timeLeft > 0 && challenge) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && challenge) {
      toast.error('⏰ Time expired! Try again.');
      fetchChallenge();
      setCurrentStep(0);
      setTimeLeft(10);
    }
  }, [timeLeft, challenge]);

  if (!challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-white text-xl">Loading challenge...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-white/20">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎯</div>
          <h2 className="text-2xl font-bold text-white">Gesture Challenge</h2>
          <p className="text-gray-400 text-sm">
            {email} • Step {currentStep + 1} of {challenge.sequence.length}
          </p>
          <div className="mt-2 text-yellow-400 text-sm">
            ⏰ {timeLeft}s remaining
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Progress</span>
            <span>{currentStep + 1}/{challenge.sequence.length}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
              style={{ width: `${((currentStep) / challenge.sequence.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Current Gesture Hint */}
        <div className="text-center mb-6">
          <p className="text-gray-300 text-lg">
            Perform this gesture:
          </p>
          <div className="text-6xl my-4 text-white font-bold">
            {challenge.sequence[currentStep]}
          </div>
          <p className="text-gray-500 text-sm">Select the matching gesture below</p>
        </div>

        {/* Gesture Buttons Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {gestures.map((gesture, index) => (
            <button
              key={index}
              onClick={() => handleGestureSelect(gesture)}
              disabled={isVerifying}
              className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-4 text-white transition hover:scale-105 disabled:opacity-50"
            >
              {gesture}
            </button>
          ))}
        </div>

        {/* Status */}
        {isVerifying && (
          <div className="text-center text-yellow-400 animate-pulse">
            🔄 Verifying challenge...
          </div>
        )}

        {/* Back */}
        <button
          onClick={() => navigate('/login/hand', { state: { email } })}
          className="w-full mt-3 text-gray-500 text-sm hover:text-gray-300 transition"
        >
          ← Back to Hand
        </button>
      </div>
    </div>
  );
}