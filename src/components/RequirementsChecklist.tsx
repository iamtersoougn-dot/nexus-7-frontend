import { useMemo, useState } from 'react';
import { CheckCircle2, CircleDashed, Clock3, ListChecks } from 'lucide-react';
import type { FactoryContract, PlanRequirement } from '../services/api';

type Status = { kind: 'built'; by: string[] } | { kind: 'later'; reason: string } | { kind: 'missing' };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Same rule as the backend: a reference only counts when that part of the plan exists. */
const exists = (c: FactoryContract, ref: string) => {
  const [kind, ...rest] = ref.split(':');
  const value = norm(rest.join(':'));
  switch (norm(kind)) {
    case 'screen':
      return c.screens.some((s) => norm(s.name) === value);
    case 'module':
      return c.modules.some((m) => norm(m.path) === value);
    case 'route': {
      const [method, ...p] = value.split(' ');
      return c.apiRoutes.some((r) => norm(r.method) === method && norm(r.path) === p.join(' ').trim());
    }
    case 'entity':
      return c.entities.some((e) => norm(e.name) === value);
    case 'addon':
      return (c.capabilities || []).includes(value);
    case 'auth':
      return c.auth?.required !== false;
    case 'payments':
      return Boolean(c.payments?.enabled);
    default:
      return false;
  }
};

const statusOf = (c: FactoryContract, r: PlanRequirement): Status => {
  const by = (c.coverage || []).filter((x) => x.id === r.id).flatMap((x) => x.by).filter((ref) => exists(c, ref));
  if (by.length) return { kind: 'built', by: [...new Set(by)] };
  const d = (c.deferred || []).find((x) => x.id === r.id);
  return d ? { kind: 'later', reason: d.reason } : { kind: 'missing' };
};

const label = (ref: string) => ref.replace(/^module:src\//, '').replace(/^(screen|route|entity|addon|module):/, '');

/**
 * Plan review: every requirement Nexus-7 found in a long brief, and whether the plan builds it, leaves it for later,
 * or misses it. Ticked items are added to the "Bigger changes" box so a revised plan includes them.
 */
export default function RequirementsChecklist({
  contract,
  disabled,
  onInclude,
}: {
  contract: FactoryContract;
  disabled: boolean;
  onInclude: (text: string) => void;
}) {
  const rows = useMemo(() => (contract.requirements || []).map((r) => ({ r, s: statusOf(contract, r) })), [contract]);
  const [picked, setPicked] = useState<string[]>([]);
  if (!rows.length) return null;

  const built = rows.filter((x) => x.s.kind === 'built').length;
  const later = rows.filter((x) => x.s.kind === 'later').length;
  const missing = rows.length - built - later;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const include = () => {
    const chosen = rows.filter((x) => picked.includes(x.r.id));
    onInclude(`Include these requirements in this version: ${chosen.map((x) => `${x.r.id} (${x.r.text})`).join('; ')}`);
    setPicked([]);
  };

  return (
    <div className="border-t border-zinc-800/60 pt-4" aria-label="Requirements checklist">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[10px] font-mono uppercase text-zinc-500 flex items-center gap-1.5">
          <ListChecks className="h-3 w-3" /> Requirements from your brief
        </span>
        <span className="text-[10px] font-mono text-zinc-400">
          <span className="text-emerald-400">{built} built</span>
          {later > 0 && <span className="text-amber-300"> · {later} later</span>}
          {missing > 0 && <span className="text-rose-400"> · {missing} not covered</span>}
          {' '}of {rows.length}
        </span>
      </div>
      <ul className="mt-2 max-h-72 overflow-y-auto divide-y divide-zinc-800/60 rounded-lg border border-zinc-800/60">
        {rows.map(({ r, s }) => (
          <li key={r.id} className="flex items-start gap-2 px-3 py-2 text-[11px]">
            {s.kind === 'built' ? (
              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-400" aria-label="Built by the plan" />
            ) : (
              <input
                type="checkbox"
                className="mt-0.5 accent-indigo-500"
                checked={picked.includes(r.id)}
                onChange={() => toggle(r.id)}
                disabled={disabled}
                aria-label={`Include ${r.id} in this version`}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-zinc-200">
                <span className="font-mono text-zinc-500 mr-1.5">{r.id}</span>
                {r.text}
                {r.priority !== 'must' && <span className="ml-1.5 text-[9px] font-mono uppercase text-zinc-500">{r.priority}</span>}
              </p>
              {s.kind === 'built' && <p className="text-[10px] text-zinc-500 mt-0.5">Built by: {s.by.map(label).join(', ')}</p>}
              {s.kind === 'later' && (
                <p className="text-[10px] text-amber-300/90 mt-0.5 flex items-center gap-1">
                  <Clock3 className="h-3 w-3" /> Later version: {s.reason}
                </p>
              )}
              {s.kind === 'missing' && (
                <p className="text-[10px] text-rose-400 mt-0.5 flex items-center gap-1">
                  <CircleDashed className="h-3 w-3" /> Not covered by this plan
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {built < rows.length && (
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={include}
            disabled={disabled || !picked.length}
            className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white disabled:opacity-50 cursor-pointer"
          >
            Add ticked to changes ({picked.length})
          </button>
          <span className="text-[10px] text-zinc-500">Then press Revise plan below.</span>
        </div>
      )}
    </div>
  );
}
