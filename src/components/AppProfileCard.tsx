import { useEffect, useState } from 'react';
import { Check, Copy, Download, Info, Loader2 } from 'lucide-react';
import { appProfileDownloadUrl, fetchAppProfile, type AppProfile } from '../services/api';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
    <h4 className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 mb-2">{title}</h4>
    {children}
  </section>
);

const Bullets = ({ items, empty = 'None' }: { items: React.ReactNode[]; empty?: string }) =>
  items.length ? (
    <ul className="space-y-1 text-[12px] text-zinc-300 list-disc pl-4">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  ) : (
    <p className="text-[11px] text-zinc-500">{empty}</p>
  );

/**
 * "About" tab: Nexus-7's description of the app — what it does, features, screens, data, API, add-ons, stack,
 * quality and changes. `refreshKey` changes after every run so the description stays current.
 */
export default function AppProfileCard({ projectId, refreshKey }: { projectId: string; refreshKey: string }) {
  const [data, setData] = useState<{ profile: AppProfile; markdown: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchAppProfile(projectId)
      .then((r) => alive && (setData({ profile: r.profile, markdown: r.markdown }), setError(null)))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [projectId, refreshKey]);

  if (error) return <p className="p-5 text-[11px] font-mono text-zinc-500">{error}</p>;
  if (!data)
    return (
      <p className="p-5 text-[11px] font-mono text-zinc-500 flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the app profile…
      </p>
    );
  const p = data.profile;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the download still works */
    }
  };

  return (
    <div className="p-5 space-y-4" aria-label="App profile">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Info className="h-4 w-4 text-indigo-400" /> {p.name}
          </h3>
          <p className="text-[12px] text-zinc-300 mt-1">{p.summary}</p>
          <p className="text-[10px] font-mono text-zinc-500 mt-1">{p.kind}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
          </button>
          <a
            href={appProfileDownloadUrl(projectId)}
            className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="What it does">
          <Bullets items={p.features} />
          {p.later.length > 0 && (
            <>
              <p className="text-[10px] font-mono uppercase text-amber-300/80 mt-3 mb-1">Planned for a later version</p>
              <Bullets items={p.later.map((l) => `${l.text}${l.reason ? ` (${l.reason})` : ''}`)} />
            </>
          )}
        </Section>
        <Section title="Stack">
          <Bullets items={p.stack} />
          <p className="text-[10px] font-mono uppercase text-zinc-500 mt-3 mb-1">Accounts, payments, add-ons</p>
          <Bullets items={[`Accounts: ${p.accounts}`, `Payments: ${p.payments}`, `Add-ons: ${p.addOns.join(', ') || 'None'}`]} />
        </Section>
        <Section title={`Screens (${p.screens.length})`}>
          <Bullets
            items={p.screens.map((s) => (
              <>
                <span className="text-zinc-100">{s.name}</span> — {s.purpose}
              </>
            ))}
          />
        </Section>
        <Section title={`Data it keeps (${p.dataTypes.length})`}>
          <Bullets
            items={p.dataTypes.map((d) => (
              <>
                <span className="text-zinc-100">{d.name}</span>
                {d.fields.length > 0 && <span className="text-zinc-500"> — {d.fields.join(', ')}</span>}
              </>
            ))}
          />
        </Section>
        <Section title={`API (${p.apiRoutes.length})`}>
          <Bullets items={p.apiRoutes.map((r) => <span className="font-mono text-[11px]">{r}</span>)} />
        </Section>
        <Section title="Quality and history">
          <Bullets
            items={[
              p.quality?.tier ? `Quality tier: ${p.quality.tier}` : 'Not checked yet',
              ...(p.quality?.tests ? [`Unit tests: ${p.quality.tests}`] : []),
              ...(p.quality?.issues !== undefined ? [`Open issues: ${p.quality.issues}`] : []),
              ...(p.build.created ? [`First built: ${new Date(p.build.created).toLocaleDateString()}`] : []),
              ...(p.build.lastRun ? [`Last run: ${new Date(p.build.lastRun).toLocaleString()}`] : []),
              ...(p.build.files !== undefined ? [`Files: ${p.build.files}`] : []),
              ...(p.build.costUsd !== undefined ? [`AI cost so far: about $${p.build.costUsd.toFixed(2)}`] : []),
              ...(p.build.github ? [`GitHub: ${p.build.github}`] : []),
            ]}
          />
          <p className="text-[10px] font-mono uppercase text-zinc-500 mt-3 mb-1">Changes since the first build</p>
          <Bullets items={p.changes.map((c) => `${c.when ? `${c.when}: ` : ''}${c.what}`)} empty="None yet" />
        </Section>
      </div>
      <p className="text-[10px] text-zinc-500">
        Kept up to date after every build, check and change, and saved in the app's folder as APP_PROFILE.md.
      </p>
    </div>
  );
}
