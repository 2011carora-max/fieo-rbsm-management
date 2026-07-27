import { useState } from 'react';
import { Building2, Mail, Lock, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { FieoLogo } from '@/components/FieoLogo';
import { useAuth } from '@/context/AuthContext';

// Login screen — official FIEO branding with a government-style header band.
export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@fieo.org');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (!res.ok) setError(res.error ?? 'Login failed.');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Government header band */}
      <div className="bg-fieo-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between text-xs">
          <span className="flex items-center gap-2">
            <Building2 size={14} />
            Ministry of Commerce &amp; Industry, Government of India
          </span>
          <span className="hidden sm:inline">https://www.fieo.org</span>
        </div>
      </div>

      <div className="flex-1 grid lg:grid-cols-2">
        {/* Brand panel */}
        <div className="relative bg-fieo-600 text-white p-10 lg:p-16 flex flex-col justify-between overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="relative">
            <div className="flex items-center gap-4">
              <FieoLogo size={64} />
              <div>
                <h1 className="font-serif text-2xl font-bold">FIEO</h1>
                <p className="text-sm text-fieo-100">Federation of Indian Export Organisations</p>
              </div>
            </div>
          </div>
          <div className="relative max-w-md">
            <h2 className="font-serif text-3xl lg:text-4xl font-bold leading-tight">
              RBSM Management System
            </h2>
            <p className="mt-4 text-fieo-100 text-sm lg:text-base leading-relaxed">
              A centralized portal to monitor and evaluate the outcomes of Buyer-Seller Meets
              conducted by FIEO Regional Offices — eliminating manual Excel tracking.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 text-xs text-fieo-100">
              <span className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur">Outcome Tracking</span>
              <span className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur">Analytics</span>
              <span className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur">Reports</span>
            </div>
          </div>
          <p className="relative text-xs text-fieo-200">© {new Date().getFullYear()} Federation of Indian Export Organisations. All rights reserved.</p>
        </div>

        {/* Form panel */}
        <div className="flex items-center justify-center p-6 lg:p-16">
          <div className="w-full max-w-md">
            <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
              <FieoLogo size={48} />
              <div>
                <h1 className="font-serif text-xl font-bold text-fieo-700 dark:text-white">FIEO</h1>
                <p className="text-xs text-gray-500">RBSM Management System</p>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sign in</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Access the FIEO RBSM outcome tracking portal.</p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="label">Email address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    className="input pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@fieo.org"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="input pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-300 px-3 py-2 rounded-lg" role="alert">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><LogIn size={18} /> Sign in</>
                )}
              </button>
            </form>

            <div className="mt-6 p-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300">
              <p className="font-semibold mb-1.5">Head Office admin account:</p>
              <p><code className="font-mono">admin@fieo.org</code></p>
              <p className="mt-1 text-gray-400">Create regional office accounts from Settings → Users after signing in.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
