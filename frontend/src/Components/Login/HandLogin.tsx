import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function HandLogin() {
  const [isScanning, setIsScanning] = useState(false);
  const [gestureDetected, setGestureDetected] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { email } = location.state || {};

  useEffect(() => {
    if (!email) {
      navigate('/login');
      return;
    }
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      toast.error('Camera access denied');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const scanHand = () => {
    setIsScanning(true);
    
    // Simulate hand scanning
    setTimeout(() => {
      setGestureDetected(true);
      toast.success('Hand detected! 🤚');
      
      setTimeout(() => {
        // Move to gesture challenge
        navigate('/login/gesture', { state: { email } });
      }, 1000);
    }, 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-white/20">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🤚</div>
          <h2 className="text-2xl font-bold text-white">Hand Verification</h2>
          <p className="text-gray-400 text-sm">{email}</p>
        </div>

        {/* Camera */}
        <div className="relative bg-black rounded-xl overflow-hidden aspect-video mb-4">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {/* Overlay - Hand guide */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-56 border-2 border-purple-500 rounded-full opacity-70" />
          </div>

          {/* Status */}
          {gestureDetected && (
            <div className="absolute top-4 right-4 bg-green-500/80 text-white px-3 py-1 rounded-full text-sm">
              ✅ Hand Detected
            </div>
          )}
        </div>

        {/* Status Text */}
        <div className="text-center mb-4">
          {!isScanning && !gestureDetected && (
            <p className="text-gray-400 text-sm">Show your hand in the circle</p>
          )}
          {isScanning && !gestureDetected && (
            <p className="text-yellow-400 text-sm animate-pulse">
              🔄 Scanning hand geometry...
            </p>
          )}
          {gestureDetected && (
            <p className="text-green-400 text-sm">✅ Hand verified! Moving to gesture challenge...</p>
          )}
        </div>

        {/* Buttons */}
        {!isScanning && !gestureDetected && (
          <button
            onClick={scanHand}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition"
          >
            🤚 Scan Hand
          </button>
        )}

        {isScanning && !gestureDetected && (
          <button
            disabled
            className="w-full bg-gray-600 text-white py-3 rounded-lg font-semibold cursor-not-allowed opacity-50"
          >
            Scanning...
          </button>
        )}

        {gestureDetected && (
          <button
            disabled
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold cursor-not-allowed opacity-70"
          >
            ✅ Verified! Redirecting...
          </button>
        )}

        {/* Back */}
        <button
          onClick={() => navigate('/login/face', { state: { email } })}
          className="w-full mt-3 text-gray-500 text-sm hover:text-gray-300 transition"
        >
          ← Back to Face
        </button>
      </div>
    </div>
  );
}