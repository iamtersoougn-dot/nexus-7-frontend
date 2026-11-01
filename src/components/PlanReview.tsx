import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Loader2, MessageSquareText, Plus, Trash2 } from 'lucide-react';
import { approvePlan, revisePlan, type FactoryContract, type FactoryJob, type PlanEdits, type PlanProduct } from '../services/api';

const ADD_ONS: Array<[string, string, string]> = [
  ['ai', 'AI', 'text, image and voice understanding (Gemini)'],
  ['charts', 'Charts', 'line, bar and pie charts'],
  ['maps', 'Maps', 'map view, distances and routes'],
  ['camera', 'Camera', 'take or upload photos'],
  ['voice', 'Voice', 'record audio, read text aloud'],
  ['whatsapp', 'WhatsApp', 'bot and messages via WhatsApp Cloud API'],
  ['model', 'Model slot', 'plug in your own prediction model'],
  ['developer', 'API keys', 'public API with keys and OpenAPI docs'],
  ['tools', 'Agent tools', 'MCP tools for AI agents'],
];

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

interface Draft {
  appName: string;
  summary: string;
  screens: Array<{ name: string; purpose: string }>;
  authRequired: boolean;
  paymentsEnabled: boolean;
  products: Array<{ name: string; naira: string; purpose: string }>;
  capabilities: string[];
  projectType: 'app' | 'api' | 'agent-tool';
}

const draftFrom = (c: FactoryContract): Draft => ({
  appName: c.appName,
  summary: c.summary,
  screens: c.screens.map((s) => ({ ...s })),
  authRequired: c.auth?.required !== false,
  paymentsEnabled: Boolean(c.payments?.enabled),
  products: (c.payments?.products || []).map((p) => ({ name: p.name, naira: String(p.amountKobo / 100), purpose: p.purpose })),
  capabilities: [...(c.capabilities || [])],
  projectType: c.projectType || 'app',
});

const input =
  'w-full bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-[12px] text-zinc-200 focus:outline-none focus:border-indigo-500/60';

/**
 * Plan review: the plan (contract) is shown before any code is generated. The user can edit the safe parts directly
 * (name, screens, sign-in, prices, add-ons) or ask for bigger changes in plain words, then approve to start building.
 */
export default function PlanReview({ job, onUpdate }: { job: FactoryJob; onUpdate: (job: FactoryJob) => void }) {
  const contract = job.contract!;
  const [draft, setDraft] = useState<Draft>(() => draftFrom(contract));
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState<'approve' | 'revise' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A revised plan arrives over the live stream: start editing from it.
  useEffect(() => setDraft(draftFrom(contract)), [contract]);

  const edits = useMemo((): PlanEdits => {
    const products: PlanProduct[] = draft.products
      .map((p) => ({ name: p.name.trim(), amountKobo: Math.round(Number(p.naira) * 100), purpose: p.purpose.trim() || p.name.trim() }))
      .filter((p) => p.name && Number.isFinite(p.amountKobo) && p.amountKobo >= 100);
    return {
      appName: draft.appName,
      summary: draft.summary,
      screens: draft.screens.filter((s) => s.name.trim()),
      authRequired: draft.authRequired,
      payments: { enabled: draft.paymentsEnabled && products.length > 0, products },
      capabilities: draft.capabilities,
      projectType: draft.projectType,
    };
  }, [draft]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const revising = job.status === 'running' && job.stages.contract === 'running';

  const approve = async () => {
    setBusy('approve');
    setError(null);
    try {
      onUpdate((await approvePlan(job.id, edits)).job);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const revise = async () => {
    if (feedback.trim().length < 3) {
      setError('Describe the changes you want (for example: "add a screen for drivers to upload receipts").');
      return;
    }
    setBusy('revise');
    setError(null);
    try {
      onUpdate((await revisePlan(job.id, feedback.trim())).job);
      setFeedback('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  if (revising) {
    return (
      <div className="px-5 py-6 border-b border-zinc-800/60 flex items-center gap-3 text-[12px] font-mono text-indigo-300">
        <Loader2 className="h-4 w-4 animate-spin" /> Revising the plan with your changes…
      </div>
    );
  }

  return (
    <section className="px-5 py-5 border-b border-zinc-800/60 bg-indigo-500/[0.03] space-y-5" aria-label="Plan review">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold tracking-widest uppercase font-mono text-indigo-300 flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Review the plan
          </h4>
          <p className="text-[11px] text-zinc-400 mt-1 max-w-xl">
            Nothing has been built yet. Check the screens, data and prices below, edit what you like, or ask for bigger changes.
            Building starts when you approve.
          </p>
        </div>
        <button
          onClick={approve}
          disabled={busy !== null}
          className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-lg bg-emerald-600 border border-emerald-500 text-white font-bold hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
        >
          {busy === 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Approve & build
        </button>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-[10px] font-mono uppercase text-zinc-500">App name</span>
          <input className={input} value={draft.appName} onChange={(e) => set('appName', e.target.value)} maxLength={60} />
        </label>
        <fieldset>
          <legend className="text-[10px] font-mono uppercase text-zinc-500">Product type</legend>
          <div className="flex gap-2 mt-1">
            {([
              ['app', 'App'],
              ['api', 'API service'],
              ['agent-tool', 'Agent tool'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => set('projectType', value)}
                className={`text-[11px] font-mono px-2.5 py-1.5 rounded-md border cursor-pointer ${draft.projectType === value ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-300' : 'border-zinc-800 text-zinc-400'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block md:col-span-2">
          <span className="text-[10px] font-mono uppercase text-zinc-500">Summary</span>
          <textarea className={`${input} h-14 resize-y`} value={draft.summary} onChange={(e) => set('summary', e.target.value)} maxLength={400} />
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h5 className="text-[10px] font-mono uppercase text-zinc-500">Screens ({draft.screens.length})</h5>
          <button
            type="button"
            onClick={() => set('screens', [...draft.screens, { name: '', purpose: '' }])}
            className="text-[10px] font-mono text-indigo-300 hover:text-indigo-200 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="h-3 w-3" /> Add screen
          </button>
        </div>
        <ul className="mt-2 space-y-2">
          {draft.screens.map((s, i) => (
            <li key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2 items-start">
              <input
                className={input}
                value={s.name}
                placeholder="Screen name"
                aria-label={`Screen ${i + 1} name`}
                onChange={(e) => set('screens', draft.screens.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <input
                className={input}
                value={s.purpose}
                placeholder="What the user does here"
                aria-label={`Screen ${i + 1} purpose`}
                onChange={(e) => set('screens', draft.screens.map((x, j) => (j === i ? { ...x, purpose: e.target.value } : x)))}
              />
              <button
                type="button"
                onClick={() => set('screens', draft.screens.filter((_, j) => j !== i))}
                disabled={draft.screens.length <= 1}
                aria-label={`Remove screen ${s.name || i + 1}`}
                className="p-2 text-zinc-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h5 className="text-[10px] font-mono uppercase text-zinc-500">Data ({contract.entities.length} types)</h5>
          <ul className="mt-2 space-y-1.5">
            {contract.entities.map((e) => (
              <li key={e.name} className="text-[11px] text-zinc-300">
                <span className="font-bold">{e.name}</span>
                <span className="text-zinc-500"> — {e.fields.map((f) => f.name).join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h5 className="text-[10px] font-mono uppercase text-zinc-500">API ({contract.apiRoutes.length} routes)</h5>
          <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {contract.apiRoutes.map((r) => (
              <li key={`${r.method} ${r.path}`} className="text-[10px] font-mono text-zinc-400">
                <span className="text-indigo-300">{r.method}</span> {r.path} <span className="text-zinc-600">— {r.purpose}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[12px] text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={draft.authRequired} onChange={(e) => set('authRequired', e.target.checked)} />
            Users sign in (accounts)
          </label>
          <label className="flex items-center gap-2 text-[12px] text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={draft.paymentsEnabled} onChange={(e) => set('paymentsEnabled', e.target.checked)} />
            Take payments (Paystack)
          </label>
          {draft.paymentsEnabled && (
            <div className="space-y-2 pl-6">
              {draft.products.map((p, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] gap-2">
                  <input
                    className={input}
                    value={p.name}
                    placeholder="Product, e.g. Premium monthly"
                    aria-label={`Product ${i + 1} name`}
                    onChange={(e) => set('products', draft.products.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  />
                  <input
                    className={input}
                    value={p.naira}
                    inputMode="decimal"
                    placeholder="₦ price"
                    aria-label={`Product ${i + 1} price in naira`}
                    onChange={(e) => set('products', draft.products.map((x, j) => (j === i ? { ...x, naira: e.target.value.replace(/[^\d.]/g, '') } : x)))}
                  />
                  <button
                    type="button"
                    onClick={() => set('products', draft.products.filter((_, j) => j !== i))}
                    aria-label={`Remove product ${p.name || i + 1}`}
                    className="p-2 text-zinc-500 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => set('products', [...draft.products, { name: '', naira: '', purpose: '' }])}
                className="text-[10px] font-mono text-indigo-300 hover:text-indigo-200 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Add product
              </button>
              {edits.payments?.products.length ? (
                <p className="text-[10px] text-zinc-500">
                  The server charges exactly these prices: {edits.payments.products.map((p) => `${p.name} ${naira(p.amountKobo)}`).join(' · ')}
                </p>
              ) : (
                <p className="text-[10px] text-amber-400/80">Add at least one product with a price of ₦1 or more, or payments stay off.</p>
              )}
            </div>
          )}
        </div>
        <fieldset>
          <legend className="text-[10px] font-mono uppercase text-zinc-500">Add-ons</legend>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {ADD_ONS.map(([id, label, hint]) => (
              <label key={id} className="flex items-start gap-2 text-[11px] text-zinc-300 cursor-pointer" title={hint}>
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={draft.capabilities.includes(id)}
                  onChange={(e) => set('capabilities', e.target.checked ? [...draft.capabilities, id] : draft.capabilities.filter((c) => c !== id))}
                />
                <span>
                  {label}
                  <span className="block text-[9px] text-zinc-500">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="border-t border-zinc-800/60 pt-4">
        <label className="block">
          <span className="text-[10px] font-mono uppercase text-zinc-500 flex items-center gap-1.5">
            <MessageSquareText className="h-3 w-3" /> Bigger changes (data, features, workflow)
          </span>
          <textarea
            className={`${input} h-16 resize-y mt-1`}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder='e.g. "Add a Drivers data type with licence expiry, and a screen for admins to approve drivers"'
            maxLength={2000}
          />
        </label>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={revise}
            disabled={busy !== null}
            className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white disabled:opacity-50 cursor-pointer"
          >
            {busy === 'revise' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquareText className="h-3.5 w-3.5" />} Revise plan
          </button>
          <span className="text-[10px] text-zinc-500">Redrafts the plan (about a minute), then you review it again.</span>
        </div>
      </div>
      {error && <p className="text-[11px] font-mono text-rose-400">{error}</p>}
    </section>
  );
}
