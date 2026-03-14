import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register, loginWithGoogle, resetPassword, configured } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password);
      }
      navigate('/tutor');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/tutor');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    if (!email.trim()) {
      setError('Enter your email first, then click Reset Password.');
      return;
    }
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setNotice('Password reset email sent. Check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-brand">
          <GraduationCap size={28} />
          <h1>StudyAI</h1>
        </div>
        <p className="auth-subtitle">Sign in to sync your learning history across devices.</p>

        {!configured && (
          <div className="error-banner">
            Firebase is not configured. Add VITE_FIREBASE_* variables in .env to enable authentication.
          </div>
        )}

        {error && <div className="error-banner">{error}</div>}
        {notice && <div className="auth-notice">{notice}</div>}

        <div className="auth-switch">
          <button
            className={`btn btn--sm ${mode === 'login' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setMode('login')}
            type="button"
          >
            <LogIn size={14} /> Login
          </button>
          <button
            className={`btn btn--sm ${mode === 'register' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setMode('register')}
            type="button"
          >
            <UserPlus size={14} /> Register
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            className="text-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
          />
          <input
            className="text-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            minLength={6}
            required
          />
          <button className="btn btn--primary" type="submit" disabled={loading || !configured}>
            {mode === 'login' ? 'Login' : 'Create Account'}
          </button>
          {mode === 'login' && (
            <button className="btn btn--ghost btn--sm" type="button" onClick={handlePasswordReset} disabled={loading || !configured}>
              Reset Password
            </button>
          )}
        </form>

        <div className="auth-divider">or</div>
        <button className="btn btn--secondary" onClick={handleGoogle} disabled={loading || !configured}>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
