import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

export default function OTPVerification() {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(300);
    const [canResend, setCanResend] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const location = useLocation();
    const navigate = useNavigate();
    const { setAuth } = useAuth();   // ✅ Use setAuth instead of login

    const { email, isNewUser, fastMode, trustDevice, deviceInfo } = location.state || {};

    useEffect(() => {
        if (!email) {
            navigate('/');
            return;
        }

        const interval = setInterval(() => {
            setTimer((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setCanResend(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [email, navigate]);

    const handleChange = (index: number, value: string) => {
        if (value.length > 1) return;
        if (!/^[0-9]*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        if (value && index === 5) {
            const fullOtp = newOtp.join('');
            if (fullOtp.length === 6) {
                handleVerify(fullOtp);
            }
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (otpCode?: string) => {
        const finalOtp = otpCode || otp.join('');
        if (finalOtp.length !== 6) {
            toast.error('Please enter complete 6-digit OTP');
            return;
        }

        setLoading(true);
        try {
            const deviceData = {
                deviceId: deviceInfo?.fingerprint || 'unknown',
                deviceName: deviceInfo?.deviceType || 'Unknown Device',
                os: deviceInfo?.os || 'Unknown',
                browser: deviceInfo?.browser || 'Unknown',
            };

            const res = await api.post('/auth/verify-otp', {
                email,
                otp: finalOtp,
                name: email.split('@')[0],
                ...deviceData,
            });

            const { token, user, recoveryCodes, device } = res.data.data;

            // ✅ Set auth directly using setAuth (no extra API call)
            setAuth(token, user);

            // Show recovery codes if new user
            if (recoveryCodes && recoveryCodes.length > 0) {
                toast.success('🎉 Welcome! Save your recovery codes (check console)');
                console.log('Recovery Codes:', recoveryCodes);
                localStorage.setItem('recoveryCodes', JSON.stringify(recoveryCodes));
            }

            toast.success(isNewUser ? '🎉 Account created!' : '✅ Verified!');

            // ✅ Navigate based on mode and device
            if (device && !device.isApproved) {
                navigate('/login/device-approval', { state: { deviceId: device.deviceId } });
            } else if (fastMode && device?.isTrusted) {
                navigate('/dashboard');
            } else {
                navigate('/login/face', {
                    state: {
                        email,
                        isNewUser,
                        fastMode,
                        trustDevice,
                        deviceInfo,
                    },
                });
            }
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || 'Invalid OTP. Please try again.';
            toast.error(errorMsg);
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setLoading(true);
        try {
            await api.post('/auth/send-otp', { email });
            toast.success('New OTP sent!');
            setTimer(300);
            setCanResend(false);
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to resend OTP');
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-900 to-gray-800 p-4">
            <div className="w-full max-w-md bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-white/20">
                <div className="text-center mb-8">
                    <div className="text-4xl mb-3">📧</div>
                    <h2 className="text-2xl font-bold text-white">Verify Your Email</h2>
                    <p className="text-gray-400 text-sm mt-1">
                        We sent a 6-digit code to <span className="text-blue-400">{email}</span>
                    </p>
                    {isNewUser && <p className="text-green-400 text-xs mt-2">✨ New user registration</p>}
                </div>

                <div className="flex justify-center gap-2 mb-6">
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={(el) => {
                                inputRefs.current[index] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            className="w-12 h-14 text-center text-2xl font-bold bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            disabled={loading}
                            autoFocus={index === 0}
                        />
                    ))}
                </div>

                <div className="text-center mb-6">
                    {timer > 0 ? (
                        <p className="text-gray-400 text-sm">
                            ⏳ Code expires in <span className="text-blue-400 font-semibold">{formatTime(timer)}</span>
                        </p>
                    ) : (
                        <button
                            onClick={handleResend}
                            disabled={loading || !canResend}
                            className="text-blue-400 hover:text-blue-300 text-sm font-medium transition disabled:opacity-50"
                        >
                            🔄 Resend OTP
                        </button>
                    )}
                </div>

                <button
                    onClick={() => handleVerify()}
                    disabled={loading || otp.join('').length !== 6}
                    className="w-full bg-linear-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Verifying...
                        </>
                    ) : (
                        'Verify & Continue →'
                    )}
                </button>

                <button
                    onClick={() => navigate('/')}
                    className="w-full mt-3 text-gray-500 text-sm hover:text-gray-300 transition"
                >
                    ← Change Email
                </button>

                <p className="text-center text-gray-500 text-xs mt-4">
                    Didn't receive the code? Check your spam folder.
                </p>
            </div>
        </div>
    );
}