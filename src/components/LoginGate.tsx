import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { login } from '../services/api';

/** Shown when Nexus-7 runs on a network (HOST=0.0.0.0) and this browser has not entered the access key yet. */
export default function LoginGate({ onSuccess }: { onSuccess: () => void }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(key.trim());
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^\[GATEWAY ERROR \d+\]\s*/, '') : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-zinc-950/95 backdrop-blur flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center">
            <KeyRound className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest uppercase text-zinc-100">Nexus-7 Access</h1>
            <p className="text-[10px] font-mono text-zinc-500">This workstation is shared on the network.</p>
          </div>
        </div>
        <label htmlFor="access-key" className="block text-[10px] font-mono font-bold uppercase text-zinc-500">
          Access key
        </label>
        <input
          id="access-key"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm font-mono text-zinc-100 focus:outline-none focus:border-indigo-500/60"
        />
        {error && <p className="text-[11px] font-mono text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={busy || !key.trim()}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white py-2.5 rounded-lg text-[11px] font-bold tracking-widest uppercase cursor-pointer"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Unlock
        </button>
        <p className="text-[10px] font-mono text-zinc-600 leading-relaxed">
          The key is printed in the backend window at startup (and saved in nexus-7-backend/data/access-key.txt), or set it yourself with NEXUS_ACCESS_KEY in .env.
        </p>
      </form>
    </div>
  );
}
