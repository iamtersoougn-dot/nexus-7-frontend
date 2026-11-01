import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CloudUpload, ExternalLink, Globe, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { checkLiveApp, fetchDeployInfo, saveLiveUrl, type DeployInfo } from '../services/api';

/**
 * Deploy to Render: Publish to GitHub (step 1) → open Render's Blueprint link (step 2) → paste the live address (step 3).
 * After the first deploy, every "Push latest to GitHub" redeploys automatically.
 */
export default function DeployCard({ projectId, published, refreshKey, paymentsEnabled }: { projectId: string; published: boolean; refreshKey: number; paymentsEnabled: boolean }) {
  const [deploy, setDeploy] = useState<DeployInfo | null>(null);
  const [renderLink, setRenderLink] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<'save' | 'check' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchDeployInfo(projectId);
      setDeploy(data.deploy);
      setRenderLink(data.renderLink);
      if (data.deploy) setUrl(data.deploy.url);
    } catch {
      /* backend offline */
    }
  }, [projectId]);

  useEffect(() => {
    setDeploy(null);
    setUrl('');
    setError(null);
    void load();
  }, [load, refreshKey]);

  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      setDeploy((await saveLiveUrl(projectId, url)).deploy);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const check = async () => {
    setBusy('check');
    setError(null);
    try {
      setDeploy((await checkLiveApp(projectId)).deploy);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const last = deploy?.lastCheck;
  const step = (n: number, done: boolean, title: string, body: React.ReactNode) => (
    <li className="flex gap-3">
      <span className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border text-[10px] font-mono flex items-center justify-center ${done ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300' : 'border-zinc-700 text-zinc-400'}`}>
        {done ? '✓' : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-zinc-200">{title}</p>
        <div className="text-[11px] text-zinc-400 mt-0.5 space-y-1.5">{body}</div>
      </div>
    </li>
  );

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <h4 className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 flex items-center gap-1.5 mb-3">
        <CloudUpload className="h-3.5 w-3.5" /> Deploy to Render — live web address
      </h4>
      <ol className="space-y-4">
        {step(1, published, 'Publish to GitHub', <p>Use the Git versions section below. The repo includes <code className="text-zinc-300">render.yaml</code>, which tells Render to create the web app and its PostgreSQL database.</p>)}
        {step(
          2,
          Boolean(deploy),
          'Create it on Render',
          <>
            {renderLink ? (
              <a
                href={renderLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/50 bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-500"
              >
                <Globe className="h-3.5 w-3.5" /> Deploy to Render <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <p className="text-zinc-500">Publish to GitHub first — the button appears here.</p>
            )}
            <p>
              Render shows what it will create; enter {paymentsEnabled ? 'your Paystack secret key and ' : ''}your Gemini key if asked, then click
              <span className="text-zinc-200"> Apply</span>. The first build takes a few minutes.
            </p>
            <p className="text-zinc-500">
              It starts on Render's free plans: the app sleeps when idle and the free database expires after a while. Switch both to paid plans
              before real users arrive.
            </p>
          </>
        )}
        {step(
          3,
          Boolean(last?.ok),
          'Save the live address',
          <>
            <div className="flex flex-wrap gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-app.onrender.com"
                aria-label="Live app address"
                className="flex-1 min-w-[220px] bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-[12px] text-zinc-200 focus:outline-none focus:border-indigo-500/60"
              />
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy !== null || !url.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:text-white disabled:opacity-50"
              >
                {busy === 'save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Save & check
              </button>
            </div>
            <p className="text-zinc-500">Copy it from the top of the service page on Render. Nexus-7 then checks the app and its database are up.</p>
          </>
        )}
      </ol>

      {deploy && (
        <div className={`mt-4 rounded-lg border px-3 py-2.5 text-[11px] ${last?.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
          <div className="flex flex-wrap items-center gap-2">
            {last?.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-amber-400" />}
            <a href={deploy.url} target="_blank" rel="noreferrer" className="font-semibold text-zinc-100 hover:underline inline-flex items-center gap-1">
              {deploy.url} <ExternalLink className="h-3 w-3" />
            </a>
            <button type="button" onClick={() => void check()} disabled={busy !== null} className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 disabled:opacity-50">
              {busy === 'check' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Check again
            </button>
          </div>
          <p className="mt-1 text-zinc-400">
            {last?.ok
              ? `Live and healthy · database: ${last.database === 'postgres' ? 'PostgreSQL' : last.database || 'unknown'}${last.seed === 'failed' ? ' · starter data failed to load' : ''}`
              : `Not answering yet: ${last?.error || 'unknown'}. A new deploy takes a few minutes; a sleeping free app wakes in about a minute.`}
            {last && <span className="text-zinc-600"> · checked {new Date(last.checkedAt).toLocaleTimeString()}</span>}
          </p>
          {last?.ok && last.database !== 'postgres' && (
            <p className="mt-1 text-amber-300/90">The live app is using its built-in database, which is wiped on every deploy. Check DATABASE_URL is set on Render.</p>
          )}
          <p className="mt-1.5 text-zinc-500">
            Updates: every <span className="text-zinc-300">Push latest to GitHub</span> redeploys automatically.
            {paymentsEnabled && (
              <>
                {' '}Paystack webhook URL: <code className="text-zinc-300">{deploy.url}/api/payments/webhook</code>
              </>
            )}
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-[11px] text-rose-300">{error}</p>}
    </section>
  );
}
