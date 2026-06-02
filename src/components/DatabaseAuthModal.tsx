import React, { useState } from 'react';
import { Database, X, Eye, EyeOff, AlertCircle, Loader } from 'lucide-react';

interface DatabaseAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticate: (password: string) => Promise<void>;
}

const DatabaseAuthModal: React.FC<DatabaseAuthModalProps> = ({ isOpen, onClose, onAuthenticate }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onAuthenticate(password);
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[#0f1117]/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#161a23] border border-white/5 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full text-[#9ca3af] hover:text-white">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-[#38bdf8]/10 rounded-xl flex items-center justify-center">
            <Database className="w-6 h-6 text-[#38bdf8]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white uppercase tracking-widest">Database Access</h2>
            <p className="text-xs text-[#9ca3af] font-medium mt-1">Enter password to connect</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-[#e5e7eb] mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full px-4 py-3 pr-12 bg-[#0f1117] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#38bdf8]/50 outline-none text-sm text-white placeholder:text-[#9ca3af]/50"
                placeholder="Enter database password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9ca3af] hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#ef4444] shrink-0 mt-0.5" />
              <p className="text-sm text-[#ef4444] font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3.5 bg-[#38bdf8] hover:bg-[#0ea5e9] disabled:bg-[#38bdf8]/50 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
          >
            {loading ? (
              <><Loader className="w-4 h-4 animate-spin" /> Authenticating...</>
            ) : (
              <><Database className="w-4 h-4" /> Connect to Database</>
            )}
          </button>
        </form>

        <p className="text-[10px] text-[#9ca3af]/50 text-center mt-4 font-medium">Contact admin for database access</p>
      </div>
    </div>
  );
};

export default DatabaseAuthModal;
