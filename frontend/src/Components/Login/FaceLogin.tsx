import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function FaceLogin() {
  console.log("🔵 FaceLogin rendered");

  const [isScanning, setIsScanning] = useState(false);
  const [livenessScore, setLivenessScore] = useState(0);
  const [step, setStep] = useState<'scan' | 'liveness' | 'complete'>('scan');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  const captureFace = () => {
    setIsScanning(true);

    // Simulate face capture
    setTimeout(() => {
      // Step 1: Face detected
      toast.success('Face detected!');

      // Step 2: Liveness check
      setStep('liveness');
      simulateLivenessCheck();
    }, 1500);
  };

  const simulateLivenessCheck = () => {
    let score = 0;
    const interval = setInterval(() => {
      score += Math.random() * 10 + 5;
      setLivenessScore(Math.min(score, 100));

      if (score >= 100) {
        clearInterval(interval);
        // Liveness passed
        toast.success('Liveness check passed! ✅');
        setStep('complete');
        setIsScanning(false);

        // Store face data and move to hand login
        setTimeout(() => {
          navigate('/login/hand', { state: { email } });
        }, 1000);
      }
    }, 200);
  };

  const handleRetry = () => {
    setStep('scan');
    setLivenessScore(0);
    setIsScanning(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-900 to-gray-800">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-white/20">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">👤</div>
          <h2 className="text-2xl font-bold text-white">Face Verification</h2>
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
          <canvas ref={canvasRef} className="hidden" />

          {/* Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-2 border-blue-500 rounded-full opacity-70 animate-pulse" />
          </div>

          {/* Liveness Progress */}
          {step === 'liveness' && (
            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-gray-800/80 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-green-400 to-blue-500 transition-all duration-200"
                  style={{ width: `${livenessScore}%` }}
                />
              </div>
              <p className="text-white text-xs text-center mt-1">
                Liveness Check: {Math.round(livenessScore)}%
              </p>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="text-center mb-4">
          {step === 'scan' && (
            <p className="text-gray-400 text-sm">Position your face in the circle</p>
          )}
          {step === 'liveness' && (
            <p className="text-yellow-400 text-sm animate-pulse">
              🔄 Performing liveness detection...
            </p>
          )}
          {step === 'complete' && (
            <p className="text-green-400 text-sm">✅ Verified successfully!</p>
          )}
        </div>

        {/* Buttons */}
        {step === 'scan' && (
          <button
            onClick={captureFace}
            disabled={isScanning}
            className="w-full bg-linear-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {isScanning ? 'Scanning...' : '📸 Capture & Verify'}
          </button>
        )}

        {step === 'liveness' && (
          <button
            disabled
            className="w-full bg-gray-600 text-white py-3 rounded-lg font-semibold cursor-not-allowed opacity-50"
          >
            Checking Liveness...
          </button>
        )}

        {step === 'complete' && (
          <button
            onClick={handleRetry}
            className="w-full bg-gray-700 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition"
          >
            Retry
          </button>
        )}

        {/* Back */}
        <button
          onClick={() => navigate('/login')}
          className="w-full mt-3 text-gray-500 text-sm hover:text-gray-300 transition"
        >
          ← Change Email
        </button>
      </div>
    </div>
  );
}