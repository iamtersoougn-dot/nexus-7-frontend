import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Timer, Boxes, CheckCircle2, ChevronRight, Circle, Download, Eye, FileCode2, FileText, Folder, FolderOpen,
  Hammer, History, Loader2, Monitor, Play, RefreshCw, ScrollText, ShieldCheck, Smartphone, Tablet, Trash2, Undo2,
  Wand2, XCircle, Upload, Save, Square, ExternalLink, GitBranch, Rocket, Zap, Brain, Coins, FlaskConical, X,
} from 'lucide-react';
import {
  exportUrl, fetchJob, fetchProjectFile, fetchProjectFiles, fetchProjects, openProjectFolder, previewUrl,
  reverifyProject, startFactoryRun, refineProject, fetchRefineHistory, undoRefine, deleteProject, deleteFailedProjects,
  streamJob, fetchGitLog, publishToGithub, runProject, stopProject, buildApk, fetchApkState, apkDownloadUrl, fetchAndroidToolchain,
  briefFromFile, fetchTemplates, saveTemplate, deleteTemplate,
  type FactoryJob, type RefineSnapshot, type ModelTier, type GitCommit, type GithubInfo, type BriefTemplate, type JobStatus, type ProjectSummary, type StageId, type StageStatus,
} from '../services/api';

const STAGES: Array<{ id: StageId; label: string; hint: string }> = [
  { id: 'contract', label: 'Contract', hint: 'Shared types & module signatures' },
  { id: 'agents', label: 'Agents', hint: 'UI · Logic · Data in parallel' },
  { id: 'scaffold', label: 'Scaffold', hint: 'Vite + Capacitor template' },
  { id: 'verify', label: 'Verify', hint: 'Static analysis + tsc --noEmit' },
  { id: 'repair', label: 'Repair', hint: 'Agents fix compiler errors' },
  { id: 'build', label: 'Build', hint: 'vite build for preview' },
];

const BRIEF_EXAMPLES = [
  'A mobile app for a Lagos laundry business: customers book pickups, track order status, and see price per item. Admin view lists today’s pickups.',
  'A savings group (ajo/esusu) tracker: members, monthly contributions, payout rotation schedule and a dashboard of who has paid.',
  'A clinic queue app: patients check in, staff see the live queue with wait times, and mark patients as seen.',
];

type Viewport = 'desktop' | 'iphone' | 'android';
type DetailTab = 'preview' | 'refine' | 'ship' | 'files' | 'contract' | 'log' | 'issues';

const fmtTokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const fmtMs = (ms: number) => (ms >= 60_000 ? `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`);
const fmtCost = (usd: number) => (usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`);

const REFINE_EXAMPLES = [
  'Add a simple PIN login screen before the dashboard',
  'Add search and a status filter to the main list',
  'Add a dark mode toggle in the header',
  'Let users export the main table as CSV',
];

const statusStyle: Record<JobStatus, string> = {
  queued: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  running: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  succeeded: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  needs_attention: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  failed: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
};

const statusLabel: Record<JobStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Verified',
  needs_attention: 'Needs attention',
  failed: 'Failed',
};

const StageIcon = ({ status }: { status: StageStatus }) => {
  if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />;
  if (status === 'done') return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-rose-400" />;
  if (status === 'skipped') return <Circle className="h-4 w-4 text-zinc-700" />;
  return <Circle className="h-4 w-4 text-zinc-600" />;
};

const isActive = (status?: JobStatus) => status === 'running' || status === 'queued';

export default function FactoryPanel() {
  const [brief, setBrief] = useState('');
  const [appName, setAppName] = useState('');
  const [verifyMode, setVerifyMode] = useState<'full' | 'syntax'>('full');
  const [starting, setStarting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [workspace, setWorkspace] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [job, setJob] = useState<FactoryJob | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('log');

  const [files, setFiles] = useState<string[]>([]);
  const [openFile, setOpenFile] = useState<{ path: string; content: string } | null>(null);
  const [viewport, setViewport] = useState<Viewport>('iphone');
  const [previewNonce, setPreviewNonce] = useState(0);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pollKey, setPollKey] = useState(0);
  const [instruction, setInstruction] = useState('');
  const [refining, setRefining] = useState(false);
  const [history, setHistory] = useState<RefineSnapshot[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tier, setTier] = useState<ModelTier>('flash');
  const [templates, setTemplates] = useState<BriefTemplate[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [github, setGithub] = useState<{ info: GithubInfo | null; configured: boolean }>({ info: null, configured: false });
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [apkAvailable, setApkAvailable] = useState<string | null>(null);
  const [toolchain, setToolchain] = useState<{ ready: boolean; javaHome: string | null; sdkDir: string | null } | null>(null);
  const [liveMode, setLiveMode] = useState<'stream' | 'poll' | null>(null);
  const specInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const lastStatus = useRef<JobStatus | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const data = await fetchProjects();
      setProjects(data.projects);
      setWorkspace(data.workspace);
    } catch {
      /* backend offline — header shows it */
    }
  }, []);

  const loadFiles = useCallback(async (id: string) => {
    try {
      const data = await fetchProjectFiles(id);
      setFiles(data.files);
    } catch {
      setFiles([]);
    }
  }, []);

  const loadHistory = useCallback(async (id: string) => {
    try {
      const data = await fetchRefineHistory(id);
      setHistory(data.history);
    } catch {
      setHistory([]);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      setTemplates((await fetchTemplates()).templates);
    } catch {
      /* offline */
    }
  }, []);

  const loadShipInfo = useCallback(async (id: string) => {
    try {
      const gitInfo = await fetchGitLog(id);
      setCommits(gitInfo.commits);
      setGithub({ info: gitInfo.github ?? null, configured: Boolean(gitInfo.githubConfigured) });
    } catch {
      setCommits([]);
      setGithub({ info: null, configured: false });
    }
    try {
      const apk = await fetchApkState(id);
      setApkAvailable(apk.available ? apk.file : null);
    } catch {
      setApkAvailable(null);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadProjects();
      void loadTemplates();
      fetchAndroidToolchain().then(setToolchain).catch(() => undefined);
    }, 0);
    return () => clearTimeout(t);
  }, [loadProjects, loadTemplates]);

  // Live updates: Server-Sent Events, falling back to polling if the stream drops.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let prevApk: string | undefined;

    const apply = (next: FactoryJob) => {
      if (cancelled) return;
      setJob(next);
      const finishedNow = lastStatus.current && isActive(lastStatus.current) && !isActive(next.status);
      lastStatus.current = next.status;
      if (finishedNow) {
        void loadProjects();
        void loadFiles(selectedId);
        void loadHistory(selectedId);
        void loadShipInfo(selectedId);
        setPreviewNonce((n) => n + 1);
        if (next.previewReady) setDetailTab('preview');
        else if (next.verification && !next.verification.ok) setDetailTab('issues');
      }
      if (next.apk?.status && prevApk === 'running' && next.apk.status !== 'running') void loadShipInfo(selectedId);
      prevApk = next.apk?.status;
    };

    const poll = async () => {
      try {
        const { job: next } = await fetchJob(selectedId);
        apply(next);
        const busy = isActive(next.status) || next.apk?.status === 'running' || ['installing', 'starting'].includes(next.run?.status || '');
        if (!cancelled) timer = setTimeout(poll, busy ? 1500 : 5000);
      } catch {
        if (!cancelled) timer = setTimeout(poll, 4000);
      }
    };

    const close = streamJob(selectedId, (next) => {
      setLiveMode('stream');
      apply(next);
    }, () => {
      if (cancelled) return;
      setLiveMode('poll');
      void poll();
    });
    return () => {
      cancelled = true;
      close();
      if (timer) clearTimeout(timer);
    };
  }, [selectedId, pollKey, loadProjects, loadFiles, loadHistory, loadShipInfo]);

  useEffect(() => {
    if (detailTab === 'log') logEndRef.current?.scrollIntoView({ block: 'end' });
  }, [job?.events.length, detailTab]);

  const selectProject = (id: string) => {
    lastStatus.current = null;
    setSelectedId(id);
    setJob(null);
    setOpenFile(null);
    setActionMessage(null);
    setFiles([]);
    setHistory([]);
    setConfirmDelete(false);
    setInstruction('');
    setCommits([]);
    setApkAvailable(null);
    void loadFiles(id);
    void loadHistory(id);
    void loadShipInfo(id);
    const summary = projects.find((p) => p.id === id);
    setDetailTab(summary?.previewReady ? 'preview' : 'files');
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (brief.trim().length < 20) {
      setFormError('Describe the app in at least a sentence or two (20+ characters).');
      return;
    }
    setStarting(true);
    setFormError(null);
    try {
      const { job: created } = await startFactoryRun(brief.trim(), appName.trim(), verifyMode, tier);
      lastStatus.current = created.status;
      setSelectedId(created.id);
      setJob(created);
      setFiles([]);
      setOpenFile(null);
      setDetailTab('log');
      void loadProjects();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  /** Start a fresh run from a failed project's brief (same name, current model + verification settings). */
  const handleRetry = async () => {
    if (!job?.brief) return;
    setActionMessage(null);
    try {
      const retryName = job.name && job.name !== 'New application' ? job.name : '';
      const { job: created } = await startFactoryRun(job.brief, retryName, verifyMode, tier);
      lastStatus.current = created.status;
      setSelectedId(created.id);
      setJob(created);
      setFiles([]);
      setOpenFile(null);
      setHistory([]);
      setCommits([]);
      setDetailTab('log');
      void loadProjects();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReverify = async () => {
    if (!selectedId) return;
    try {
      const { job: next } = await reverifyProject(selectedId);
      lastStatus.current = next.status;
      setJob(next);
      setDetailTab('log');
      setPollKey((k) => k + 1);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleOpenFolder = async () => {
    if (!selectedId) return;
    try {
      const { path } = await openProjectFolder(selectedId);
      setActionMessage(`Opened ${path}`);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const followJob = (next: FactoryJob) => {
    lastStatus.current = next.status;
    setJob(next);
    setDetailTab('log');
    setPollKey((k) => k + 1);
  };

  const handleRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || instruction.trim().length < 5) return;
    setRefining(true);
    setActionMessage(null);
    try {
      const { job: next } = await refineProject(selectedId, instruction.trim());
      setInstruction('');
      followJob(next);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setRefining(false);
    }
  };

  const handleUndo = async () => {
    if (!selectedId) return;
    try {
      followJob((await undoRefine(selectedId)).job);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteProject(selectedId);
      setSelectedId(null);
      setJob(null);
      setConfirmDelete(false);
      void loadProjects();
    } catch (err) {
      setConfirmDelete(false);
      setActionMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const failedCount = projects.filter((p) => p.status === 'failed').length;
  const handleClearFailed = async () => {
    try {
      await deleteFailedProjects();
      if (selectedId && projects.find((p) => p.id === selectedId)?.status === 'failed') {
        setSelectedId(null);
        setJob(null);
      }
      void loadProjects();
    } catch {
      /* ignore */
    }
  };

  const handleSpecUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadNote(null);
    setFormError(null);
    try {
      const result = await briefFromFile(file);
      setBrief(result.text);
      if (!appName) setAppName(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 60));
      setUploadNote(
        result.condensed
          ? `Condensed ${result.originalChars.toLocaleString()} characters from ${result.fileName} into a brief — review it before generating.`
          : `Loaded ${result.fileName}.`
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (templateName === null) {
      setTemplateName(appName || brief.split(/\s+/).slice(0, 5).join(' '));
      return;
    }
    try {
      await saveTemplate(templateName.trim() || 'Untitled brief', brief.trim());
      setTemplateName(null);
      void loadTemplates();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteTemplate(id);
      void loadTemplates();
    } catch {
      /* ignore */
    }
  };

  const handleRun = async () => {
    if (!selectedId) return;
    try {
      if (job?.run && ['installing', 'starting', 'running'].includes(job.run.status)) await stopProject(selectedId);
      else {
        await runProject(selectedId);
        setDetailTab('ship');
      }
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handlePublish = async () => {
    if (!selectedId) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const result = await publishToGithub(selectedId);
      setCommits(result.commits);
      setGithub((g) => ({ ...g, info: result.github }));
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  };

  const handleBuildApk = async () => {
    if (!selectedId) return;
    try {
      await buildApk(selectedId);
      setDetailTab('ship');
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleOpenFile = async (path: string) => {
    if (!selectedId) return;
    try {
      const data = await fetchProjectFile(selectedId, path);
      setOpenFile({ path, content: data.content });
    } catch (err) {
      setOpenFile({ path, content: err instanceof Error ? err.message : String(err) });
    }
  };

  const fileGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    files.forEach((f) => {
      const dir = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '/';
      groups.set(dir, [...(groups.get(dir) || []), f]);
    });
    return [...groups.entries()].sort(([a], [b]) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
  }, [files]);

  const issues = job?.verification?.issues || [];
  const running = isActive(job?.status);
  const appRunning = Boolean(job?.run && ['installing', 'starting', 'running'].includes(job.run.status));
  const apkBuilding = job?.apk?.status === 'running';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight uppercase flex items-center gap-3">
            <Boxes className="h-6 w-6 text-indigo-400" /> App Factory
          </h2>
          <p className="text-xs text-zinc-500 font-mono mt-2 max-w-2xl">
            Brief → design contract → UI, Logic & Data agents → verification sandbox → React + Vite + Capacitor project on this laptop.
          </p>
        </div>
        {workspace && (
          <div className="text-[10px] font-mono text-zinc-500 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 flex items-center gap-2 max-w-full">
            <Folder className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <span className="truncate" title={workspace}>Workspace: <span className="text-zinc-300">{workspace}</span></span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: new build + history */}
        <div className="lg:col-span-4 space-y-6">
          <form onSubmit={handleStart} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold tracking-widest uppercase flex items-center gap-2 font-mono text-zinc-200">
              <ChevronRight className="h-4 w-4 text-cyan-500" /> New Build
            </h3>
            <div>
              <label htmlFor="factory-name" className="text-[10px] text-zinc-500 font-mono font-bold uppercase">App name (optional)</label>
              <input
                id="factory-name"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                maxLength={60}
                placeholder="e.g. QuickWash"
                className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <div className="flex items-end justify-between gap-2">
                <label htmlFor="factory-brief" className="text-[10px] text-zinc-500 font-mono font-bold uppercase">Product brief</label>
                <button
                  type="button"
                  onClick={() => specInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1 text-[10px] font-mono text-indigo-300 hover:text-indigo-200 disabled:opacity-50 cursor-pointer"
                  title="PDF, Word (.docx), Markdown or text — long documents are condensed into a brief"
                >
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} From file
                </button>
                <input
                  ref={specInputRef}
                  type="file"
                  accept=".pdf,.docx,.md,.markdown,.txt,.html,.htm,.csv,.json"
                  className="hidden"
                  onChange={(e) => { void handleSpecUpload(e.target.files?.[0]); e.target.value = ''; }}
                />
              </div>
              <textarea
                id="factory-brief"
                value={brief}
                onChange={(e) => { setBrief(e.target.value); setFormError(null); }}
                rows={7}
                placeholder="Who is it for, what can they do, what data does it track, which screens…"
                className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-y"
              />
              {uploadNote && <p className="mt-1 text-[10px] font-mono text-emerald-400/80">{uploadNote}</p>}
              <div className="mt-2 flex items-center gap-2">
                {templateName !== null && (
                  <input
                    autoFocus
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSaveTemplate(); } if (e.key === 'Escape') setTemplateName(null); }}
                    placeholder="Template name"
                    aria-label="Template name"
                    className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1 text-[10px] font-mono text-zinc-200 focus:outline-none focus:border-indigo-500/50"
                  />
                )}
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={brief.trim().length < 20}
                  className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  <Save className="h-3 w-3" /> {templateName === null ? 'Save as template' : 'Save'}
                </button>
              </div>
              {templates.length > 0 && (
                <div className="mt-3">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-1.5">Your templates</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {templates.map((t) => (
                      <div key={t.id} className="flex items-center gap-1 group">
                        <button
                          type="button"
                          onClick={() => { setBrief(t.brief); setAppName(t.name.slice(0, 60)); }}
                          className="flex-1 min-w-0 text-left text-[10px] font-mono text-emerald-300/80 hover:text-emerald-200 bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 rounded-md px-2.5 py-1.5 truncate cursor-pointer"
                          title={t.brief}
                        >
                          ★ {t.name}
                        </button>
                        <button type="button" onClick={() => handleDeleteTemplate(t.id)} aria-label={`Delete template ${t.name}`} className="p-1 text-zinc-600 hover:text-rose-400 cursor-pointer">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="mt-3 text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-1.5">Examples</p>
              <div className="space-y-1.5">
                {BRIEF_EXAMPLES.map((ex) => (
                  <button
                    type="button"
                    key={ex}
                    onClick={() => setBrief(ex)}
                    className="w-full text-left text-[10px] font-mono text-indigo-300/80 hover:text-indigo-200 bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 rounded-md px-2.5 py-1.5 truncate cursor-pointer"
                    title={ex}
                  >
                    → {ex}
                  </button>
                ))}
              </div>
            </div>
            <fieldset>
              <legend className="text-[10px] text-zinc-500 font-mono font-bold uppercase mb-1.5">Model</legend>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['flash', 'Flash', 'fast · cheap', Zap],
                  ['pro', 'Pro', 'better code · slower', Brain],
                ] as const).map(([value, label, sub, Icon]) => (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-[11px] font-mono ${tier === value ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300' : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                  >
                    <input type="radio" name="tier" value={value} checked={tier === value} onChange={() => setTier(value)} className="sr-only" />
                    <span className="font-bold flex items-center gap-1"><Icon className="h-3 w-3" /> {label}</span>
                    <span className="text-[9px] text-zinc-500">{sub}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-[10px] text-zinc-500 font-mono font-bold uppercase mb-1.5">Verification</legend>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['full', 'Full toolchain', 'npm install · tsc · build'],
                  ['syntax', 'Fast', 'static analysis only'],
                ] as const).map(([value, label, sub]) => (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-[11px] font-mono ${verifyMode === value ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300' : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                  >
                    <input type="radio" name="verify" value={value} checked={verifyMode === value} onChange={() => setVerifyMode(value)} className="sr-only" />
                    <span className="font-bold block">{label}</span>
                    <span className="text-[9px] text-zinc-500">{sub}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {formError && <p className="text-[11px] font-mono text-rose-400">{formError}</p>}
            <button
              type="submit"
              disabled={starting || !brief.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white py-3 rounded-lg text-[11px] font-bold tracking-widest uppercase transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Generate Application
            </button>
          </form>

          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-widest uppercase font-mono text-zinc-200">Projects</h3>
              <div className="flex items-center gap-3">
                {failedCount > 0 && (
                  <button onClick={handleClearFailed} className="flex items-center gap-1 text-[10px] font-mono text-rose-400/80 hover:text-rose-300 cursor-pointer" title="Delete every failed run">
                    <Trash2 className="h-3 w-3" /> Clear {failedCount} failed
                  </button>
                )}
                <button onClick={loadProjects} aria-label="Refresh projects" className="text-zinc-500 hover:text-zinc-200 cursor-pointer">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {projects.length === 0 ? (
              <p className="p-5 text-[11px] font-mono text-zinc-500">No projects yet. Your first build will appear here.</p>
            ) : (
              <ul className="max-h-96 overflow-y-auto divide-y divide-zinc-800/60">
                {projects.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => selectProject(p.id)}
                      className={`w-full text-left px-5 py-3 hover:bg-zinc-800/30 cursor-pointer ${selectedId === p.id ? 'bg-indigo-500/5 border-l-2 border-indigo-500' : 'border-l-2 border-transparent'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-zinc-200 truncate">{p.name}</span>
                        <span className={`text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border ${statusStyle[p.status] || statusStyle.queued}`}>
                          {statusLabel[p.status] || p.status}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-zinc-500 mt-1 truncate">{p.brief}</p>
                      <p className="text-[9px] font-mono text-zinc-600 mt-1 flex justify-between gap-2">
                        <span>{new Date(p.createdAt).toLocaleString()}</span>
                        {p.costUsd ? <span title="Estimated model cost">{p.tier === 'pro' ? 'Pro · ' : ''}≈{fmtCost(p.costUsd)}</span> : null}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* RIGHT: selected project */}
        <div className="lg:col-span-8">
          {!selectedId ? (
            <div className="border border-zinc-800/50 bg-zinc-900/10 rounded-2xl h-full min-h-[420px] flex flex-col items-center justify-center p-8 text-center">
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 mb-4">
                <Hammer className="h-10 w-10 text-zinc-600" />
              </div>
              <h3 className="text-lg font-bold text-zinc-300 font-mono tracking-widest uppercase mb-2">Factory Idle</h3>
              <p className="text-xs text-zinc-500 font-mono max-w-md leading-relaxed">
                Write a brief and press Generate, or pick an existing project. Projects are written to your workspace folder
                and can be opened in VS Code, exported as .zip, or packaged for Android/iOS with Capacitor.
              </p>
            </div>
          ) : !job ? (
            <div className="h-full min-h-[420px] flex items-center justify-center text-zinc-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
              {/* Header */}
              <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-950 flex flex-col gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-zinc-100 truncate">{job.name}</h3>
                    <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border ${statusStyle[job.status]}`}>
                      {statusLabel[job.status]}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-zinc-500 mt-1 truncate" title={job.projectDir}>{job.projectDir}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {job.status === 'failed' && job.brief && (
                    <button
                      onClick={handleRetry}
                      className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg border bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500 cursor-pointer"
                      title={`Start a new run with the same brief (${tier === 'pro' ? 'Pro' : 'Flash'} model, ${verifyMode} verification)`}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Retry with same brief
                    </button>
                  )}
                  {job.contract && (
                    <button
                      onClick={handleRun}
                      disabled={running}
                      className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg border disabled:opacity-40 cursor-pointer ${appRunning ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300' : 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500'}`}
                      title={appRunning ? 'Stop the dev server' : 'Start the app with npm run dev'}
                    >
                      {appRunning ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {appRunning ? 'Stop' : 'Run'}
                    </button>
                  )}
                  {job.run?.status === 'running' && job.run.url && (
                    <a href={job.run.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider bg-zinc-800 border border-emerald-500/40 px-3 py-1.5 rounded-lg text-emerald-300 hover:text-emerald-200">
                      <ExternalLink className="h-3.5 w-3.5" /> Open app
                    </a>
                  )}
                  <button onClick={handleOpenFolder} disabled={running} className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-lg text-zinc-300 hover:text-white disabled:opacity-40 cursor-pointer">
                    <FolderOpen className="h-3.5 w-3.5" /> Open folder
                  </button>
                  <a
                    href={running ? undefined : exportUrl(job.id)}
                    aria-disabled={running}
                    className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-lg text-zinc-300 hover:text-white ${running ? 'opacity-40 pointer-events-none' : ''}`}
                  >
                    <Download className="h-3.5 w-3.5" /> Export .zip
                  </a>
                  <button onClick={handleReverify} disabled={running} className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-40 cursor-pointer">
                    <ShieldCheck className="h-3.5 w-3.5" /> Re-verify & build
                  </button>
                  <button
                    onClick={handleDelete}
                    onBlur={() => setConfirmDelete(false)}
                    disabled={running}
                    className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg border disabled:opacity-40 cursor-pointer ${confirmDelete ? 'bg-rose-600 border-rose-500 text-white' : 'bg-zinc-800 border-zinc-700 text-rose-300 hover:text-rose-200'}`}
                    title="Delete this project and its folder"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {confirmDelete ? 'Click again to delete' : 'Delete'}
                  </button>
                </div>
              </div>
              {actionMessage && <p className="px-5 py-2 text-[10px] font-mono text-zinc-400 border-b border-zinc-800 bg-zinc-950/60">{actionMessage}</p>}

              {/* Stage rail */}
              <div className="px-5 py-4 border-b border-zinc-800/60 grid grid-cols-3 md:grid-cols-6 gap-2">
                {STAGES.map((s) => (
                  <div key={s.id} className={`rounded-lg border px-2.5 py-2 ${job.stages[s.id] === 'running' ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-zinc-800 bg-zinc-950/40'}`} title={s.hint}>
                    <div className="flex items-center gap-1.5">
                      <StageIcon status={job.stages[s.id]} />
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-300">{s.label}</span>
                    </div>
                    <p className="text-[9px] font-mono text-zinc-600 mt-1 leading-tight hidden md:block">{s.hint}</p>
                  </div>
                ))}
              </div>
              <div className="px-5 py-2 border-b border-zinc-800/60 flex flex-wrap gap-x-6 gap-y-1 text-[10px] font-mono text-zinc-500">
                <span>Model: <span className="text-zinc-300">{job.tier === 'pro' ? 'Pro' : 'Flash'}{job.usage?.models?.length ? ` (${job.usage.models.join(', ')})` : ''}</span></span>
                {job.usage && job.usage.calls > 0 && (
                  <span className="flex items-center gap-1" title={`${job.usage.calls} model calls · ${job.usage.inputTokens.toLocaleString()} input + ${job.usage.outputTokens.toLocaleString()} output tokens. Prices are estimates — set PRICE_* in .env.`}>
                    <Coins className="h-3 w-3" /> Tokens: <span className="text-zinc-300">{fmtTokens(job.usage.inputTokens)} in / {fmtTokens(job.usage.outputTokens)} out</span> · <span className="text-amber-300">≈{fmtCost(job.usage.costUsd)}</span>
                  </span>
                )}
                {job.verification?.tests && (
                  <span className="flex items-center gap-1"><FlaskConical className="h-3 w-3" /> Tests: <span className={job.verification.tests.failed ? 'text-rose-400' : 'text-emerald-400'}>{job.verification.tests.passed} passed{job.verification.tests.failed ? `, ${job.verification.tests.failed} failed` : ''}</span></span>
                )}
                {job.timings && Object.keys(job.timings).length > 0 && (
                  <span
                    className="flex items-center gap-1"
                    title={Object.entries(job.timings).map(([step, ms]) => `${step}: ${fmtMs(ms)}`).join('\n')}
                  >
                    <Timer className="h-3 w-3" /> Time:{' '}
                    <span className="text-zinc-300">
                      {Object.entries(job.timings).map(([step, ms]) => `${step} ${fmtMs(ms)}`).join(' · ')}
                    </span>
                  </span>
                )}
                <span>Transitions: <span className="text-zinc-300">{job.transitions}</span></span>
                <span>Secrets scrubbed: <span className={job.redactions ? 'text-amber-400' : 'text-zinc-300'}>{job.redactions}</span></span>
                {job.verification && (
                  <span>
                    Verification ({job.verification.mode}):{' '}
                    <span className={job.verification.ok ? 'text-emerald-400' : 'text-amber-400'}>
                      {job.verification.ok ? 'passed' : `${job.verification.issues.length} issue(s)`}
                    </span>
                  </span>
                )}
                {job.error && <span className="text-rose-400">Error: {job.error}</span>}
                <span className="ml-auto flex items-center gap-1" title={liveMode === 'stream' ? 'Live updates over Server-Sent Events' : 'Live stream unavailable — polling'}>
                  <span className={`h-1.5 w-1.5 rounded-full ${liveMode === 'stream' ? 'bg-emerald-500' : 'bg-amber-500'}`} /> {liveMode === 'stream' ? 'live' : 'polling'}
                </span>
              </div>

              {/* Detail tabs */}
              <div className="flex items-center gap-1 px-3 pt-3 border-b border-zinc-800 overflow-x-auto">
                {([
                  ['preview', 'Preview', Eye],
                  ['refine', `Refine${history.length ? ` (${history.length})` : ''}`, Wand2],
                  ['ship', 'Run & Ship', Rocket],
                  ['files', 'Files', FileCode2],
                  ['contract', 'Contract', FileText],
                  ['log', 'Live Log', ScrollText],
                  ['issues', `Issues${issues.length ? ` (${issues.length})` : ''}`, AlertTriangle],
                ] as const).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    onClick={() => setDetailTab(id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-mono rounded-t-lg border-b-2 whitespace-nowrap cursor-pointer ${detailTab === id ? 'text-indigo-300 border-indigo-500 bg-zinc-900' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>

              <div className="min-h-[520px]">
                {detailTab === 'preview' && (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-1">
                        {([
                          ['desktop', 'Desktop', Monitor],
                          ['iphone', 'iPhone', Smartphone],
                          ['android', 'Android', Tablet],
                        ] as const).map(([id, label, Icon]) => (
                          <button
                            key={id}
                            onClick={() => setViewport(id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider cursor-pointer ${viewport === id ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                          >
                            <Icon className="h-3.5 w-3.5" /> {label}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setPreviewNonce((n) => n + 1)} className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 hover:text-white cursor-pointer">
                        <RefreshCw className="h-3.5 w-3.5" /> Reload
                      </button>
                    </div>
                    {!job.previewReady ? (
                      <div className="h-[460px] flex flex-col items-center justify-center text-center border border-dashed border-zinc-800 rounded-xl p-6">
                        {running ? <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" /> : <Eye className="h-8 w-8 text-zinc-600 mb-3" />}
                        <p className="text-xs font-mono text-zinc-500 max-w-sm">
                          {running
                            ? 'The preview appears once the project passes verification and builds.'
                            : 'No preview build yet. Use “Re-verify & build” (needs internet for npm install the first time).'}
                        </p>
                      </div>
                    ) : (
                      <div className="flex justify-center bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.08),_transparent_70%)] rounded-xl py-6 overflow-x-auto">
                        {viewport === 'desktop' ? (
                          <div className="w-full max-w-5xl rounded-xl border border-zinc-700 bg-zinc-800 overflow-hidden shadow-2xl">
                            <div className="h-8 flex items-center gap-1.5 px-3 bg-zinc-900 border-b border-zinc-700">
                              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
                              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                              <span className="ml-3 text-[10px] font-mono text-zinc-500 truncate">localhost · {job.name}</span>
                            </div>
                            <iframe key={`d-${previewNonce}`} title={`${job.name} desktop preview`} src={previewUrl(job)} sandbox="allow-scripts allow-forms allow-modals" className="w-full h-[560px] bg-white" />
                          </div>
                        ) : (
                          <div className={`relative shrink-0 bg-zinc-950 border-[10px] shadow-2xl ${viewport === 'iphone' ? 'w-[395px] h-[832px] rounded-[54px] border-zinc-800' : 'w-[392px] h-[820px] rounded-[30px] border-zinc-700'}`}>
                            {viewport === 'iphone' ? (
                              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-full z-10" />
                            ) : (
                              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-3 h-3 bg-black rounded-full z-10" />
                            )}
                            <iframe
                              key={`m-${viewport}-${previewNonce}`}
                              title={`${job.name} ${viewport} preview`}
                              src={previewUrl(job)}
                              sandbox="allow-scripts allow-forms allow-modals"
                              className={`w-full h-full bg-white ${viewport === 'iphone' ? 'rounded-[44px] pt-11' : 'rounded-[20px] pt-7'}`}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-[9px] font-mono text-zinc-600 mt-3 text-center">
                      Sandboxed preview of the production build. Browser storage is disabled inside the sandbox, so data resets on reload — run <code className="text-zinc-400">npm run dev</code> in the project for the full experience.
                    </p>
                  </div>
                )}

                {detailTab === 'refine' && (
                  <div className="p-5 space-y-6">
                    {!job.contract ? (
                      <p className="text-xs font-mono text-zinc-500">This run failed before a project was written, so there is nothing to refine. Delete it and generate again.</p>
                    ) : (
                      <form onSubmit={handleRefine} className="space-y-3">
                        <label htmlFor="refine-input" className="text-[10px] text-zinc-500 font-mono font-bold uppercase">
                          Describe the change
                        </label>
                        <textarea
                          id="refine-input"
                          value={instruction}
                          onChange={(e) => setInstruction(e.target.value)}
                          rows={4}
                          disabled={running || refining}
                          placeholder="e.g. Add a settings screen where the user can change the currency from USD to NGN"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-y disabled:opacity-50"
                        />
                        <div className="flex flex-wrap gap-2">
                          {REFINE_EXAMPLES.map((ex) => (
                            <button type="button" key={ex} onClick={() => setInstruction(ex)} className="text-[10px] font-mono text-indigo-300/80 hover:text-indigo-200 bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 rounded-md px-2.5 py-1.5 cursor-pointer">
                              {ex}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] font-mono text-zinc-500">The agent edits only the files it needs, then the project is re-checked with tsc and rebuilt. Every change can be undone.</p>
                          <button
                            type="submit"
                            disabled={running || refining || instruction.trim().length < 5}
                            className="shrink-0 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-4 py-2.5 rounded-lg text-[11px] font-bold tracking-widest uppercase cursor-pointer"
                          >
                            {refining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Apply change
                          </button>
                        </div>
                      </form>
                    )}

                    <section>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Change history</h4>
                        {history.length > 0 && (
                          <button onClick={handleUndo} disabled={running} className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-lg text-amber-300 hover:text-amber-200 disabled:opacity-40 cursor-pointer">
                            <Undo2 className="h-3.5 w-3.5" /> Undo latest
                          </button>
                        )}
                      </div>
                      {history.length === 0 ? (
                        <p className="text-[11px] font-mono text-zinc-600">No refinements yet.</p>
                      ) : (
                        <ol className="space-y-2">
                          {history.map((h, i) => (
                            <li key={h.id} className={`rounded-lg border p-3 ${i === 0 ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-zinc-800 bg-zinc-950/40'}`}>
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-zinc-200">{h.instruction}</p>
                                <span className="text-[9px] font-mono text-zinc-500 shrink-0">{new Date(h.createdAt).toLocaleString()}</span>
                              </div>
                              {h.summary && <p className="text-[11px] text-zinc-400 mt-1">{h.summary}</p>}
                              <p className="text-[9px] font-mono text-zinc-600 mt-1">{h.files} file(s) touched</p>
                            </li>
                          ))}
                        </ol>
                      )}
                    </section>
                  </div>
                )}

                {detailTab === 'ship' && (
                  <div className="p-5 space-y-6">
                    {/* Dev server */}
                    <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <h4 className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 flex items-center gap-1.5"><Play className="h-3.5 w-3.5" /> Dev server</h4>
                        <div className="flex items-center gap-2">
                          {job.run?.status === 'running' && job.run.url && (
                            <a href={job.run.url} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-emerald-300 hover:text-emerald-200 flex items-center gap-1">
                              {job.run.url} <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          <button onClick={handleRun} disabled={running || !job.contract} className="text-[10px] font-mono uppercase tracking-wider bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-lg text-zinc-200 hover:text-white disabled:opacity-40 cursor-pointer">
                            {appRunning ? 'Stop' : 'Run'}
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-400 mb-2">
                        {job.run ? `Status: ${job.run.status}${job.run.error ? ` — ${job.run.error}` : ''}` : 'Runs npm run dev for this project with hot reload and real browser storage (on this computer only).'}
                      </p>
                      {job.run && job.run.logs.length > 0 && (
                        <pre className="max-h-40 overflow-auto rounded-lg bg-black/50 p-3 text-[10px] font-mono text-zinc-400 whitespace-pre-wrap">{job.run.logs.slice(-40).join('\n')}</pre>
                      )}
                    </section>

                    {/* Android APK */}
                    <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <h4 className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> Android APK</h4>
                        <div className="flex items-center gap-2">
                          {apkAvailable && !apkBuilding && (
                            <a href={apkDownloadUrl(job.id)} className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider bg-emerald-600 border border-emerald-500 px-3 py-1.5 rounded-lg text-white hover:bg-emerald-500">
                              <Download className="h-3.5 w-3.5" /> {apkAvailable}
                            </a>
                          )}
                          <button onClick={handleBuildApk} disabled={running || apkBuilding || !job.contract || toolchain?.ready === false} className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-lg text-zinc-200 hover:text-white disabled:opacity-40 cursor-pointer">
                            {apkBuilding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />} {apkAvailable ? 'Rebuild APK' : 'Build APK'}
                          </button>
                        </div>
                      </div>
                      {toolchain && !toolchain.ready ? (
                        <p className="text-[11px] text-amber-300/90">
                          {!toolchain.javaHome ? 'Java (JDK) not found. ' : ''}
                          {!toolchain.sdkDir ? 'Android SDK not found. ' : ''}
                          Install Android Studio and open it once so it downloads the SDK, or set JAVA_HOME / ANDROID_HOME in nexus-7-backend/.env, then restart the backend.
                        </p>
                      ) : (
                        <p className="text-[11px] text-zinc-400 mb-2">
                          {job.apk
                            ? `${job.apk.status === 'running' ? 'Building' : job.apk.status === 'succeeded' ? 'Built' : 'Failed'} — ${job.apk.error || job.apk.step}`
                            : 'Builds a debug APK with Capacitor + Gradle that you can install on any Android phone (enable "Install unknown apps"). The first build downloads Gradle and can take 5–15 minutes.'}
                        </p>
                      )}
                      {toolchain?.ready && (
                        <p className="text-[9px] font-mono text-zinc-600 mb-2">JDK: {toolchain.javaHome} · SDK: {toolchain.sdkDir}</p>
                      )}
                      {job.apk && job.apk.logs.length > 0 && (
                        <pre className="max-h-56 overflow-auto rounded-lg bg-black/50 p-3 text-[10px] font-mono text-zinc-400 whitespace-pre-wrap">{job.apk.logs.slice(-80).join('\n')}</pre>
                      )}
                    </section>

                    {/* Git */}
                    <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                      <h4 className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 flex items-center gap-1.5 mb-3"><GitBranch className="h-3.5 w-3.5" /> Git versions</h4>
                      {commits.length === 0 ? (
                        <p className="text-[11px] text-zinc-500">No commits yet. Every new build, refinement and undo is committed automatically (needs git on PATH). Older projects start their history at their next refinement.</p>
                      ) : (
                        <ol className="space-y-1.5">
                          {commits.map((c) => (
                            <li key={c.hash} className="flex items-center gap-3 text-[11px]">
                              <code className="text-amber-300/90 font-mono">{c.hash}</code>
                              <span className="text-zinc-200 flex-1 truncate" title={c.subject}>{c.subject}</span>
                              <span className="text-[9px] font-mono text-zinc-600 shrink-0">{new Date(c.date).toLocaleString()}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                      <div className="mt-4 border-t border-zinc-800 pt-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handlePublish()}
                            disabled={publishing || job.status === 'running'}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-semibold text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
                          >
                            {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            {publishing ? 'Publishing…' : github.info ? 'Push latest to GitHub' : 'Publish to GitHub'}
                          </button>
                          {github.info && (
                            <a href={github.info.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-indigo-300 hover:text-indigo-200 underline-offset-2 hover:underline">
                              {github.info.owner}/{github.info.repo} <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {github.info && (
                            <span className="text-[9px] font-mono text-zinc-600">
                              {github.info.private ? 'private' : 'public'} · pushed {new Date(github.info.pushedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {publishError && <p className="text-[11px] text-rose-300 whitespace-pre-wrap">{publishError}</p>}
                        {!github.configured && !github.info && !publishError && (
                          <p className="text-[9px] font-mono text-zinc-600">
                            Needs <code className="text-zinc-400">GITHUB_TOKEN</code> in nexus-7-backend\.env (classic token with the <code className="text-zinc-400">repo</code> scope). Creates a private repo named after the app and pushes every commit.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>
                )}

                {detailTab === 'files' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 min-h-[520px]">
                    <div className="md:col-span-4 border-r border-zinc-800 max-h-[620px] overflow-y-auto py-2">
                      {files.length === 0 ? (
                        <p className="px-4 py-3 text-[11px] font-mono text-zinc-500">{running ? 'Files appear after the scaffold stage.' : 'No files.'}</p>
                      ) : (
                        fileGroups.map(([dir, list]) => (
                          <div key={dir} className="mb-2">
                            <p className="px-4 py-1 text-[9px] font-mono uppercase tracking-widest text-zinc-600 flex items-center gap-1"><Folder className="h-3 w-3" /> {dir}</p>
                            {list.map((f) => (
                              <button
                                key={f}
                                onClick={() => handleOpenFile(f)}
                                className={`w-full text-left px-6 py-1 text-[11px] font-mono truncate cursor-pointer ${openFile?.path === f ? 'text-indigo-300 bg-indigo-500/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'}`}
                              >
                                {f.split('/').pop()}
                              </button>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                    <div className="md:col-span-8 max-h-[620px] overflow-auto bg-black/40">
                      {openFile ? (
                        <>
                          <div className="sticky top-0 px-4 py-2 bg-zinc-950 border-b border-zinc-800 text-[10px] font-mono text-zinc-400">{openFile.path}</div>
                          <pre className="p-4 text-[11px] leading-relaxed font-mono text-zinc-300 whitespace-pre">{openFile.content}</pre>
                        </>
                      ) : (
                        <p className="p-6 text-[11px] font-mono text-zinc-600">Select a file to view its source.</p>
                      )}
                    </div>
                  </div>
                )}

                {detailTab === 'contract' && (
                  <div className="p-5 space-y-5 text-xs">
                    {!job.contract ? (
                      <p className="font-mono text-zinc-500">{running ? 'Waiting for the Contract Architect…' : 'No contract recorded.'}</p>
                    ) : (
                      <>
                        <p className="text-zinc-300">{job.contract.summary}</p>
                        <section>
                          <h4 className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 mb-2">Entities</h4>
                          <div className="grid sm:grid-cols-2 gap-3">
                            {job.contract.entities.map((en) => (
                              <div key={en.name} className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-3">
                                <p className="font-bold text-zinc-200 text-xs mb-1">{en.name}</p>
                                <p className="text-[10px] font-mono text-zinc-500">{(en.fields || []).map((f) => `${f.name}: ${f.type}`).join(' · ')}</p>
                              </div>
                            ))}
                          </div>
                        </section>
                        <section>
                          <h4 className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 mb-2">Module contract</h4>
                          <div className="space-y-2">
                            {job.contract.modules.map((m) => (
                              <div key={m.path} className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-[11px] text-zinc-200">{m.path}</span>
                                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{m.owner}</span>
                                </div>
                                <pre className="mt-2 text-[10px] font-mono text-cyan-300/80 whitespace-pre-wrap">{m.exports}</pre>
                              </div>
                            ))}
                          </div>
                        </section>
                        <div className="grid sm:grid-cols-2 gap-5">
                          <section>
                            <h4 className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 mb-2">Screens</h4>
                            <ul className="space-y-1.5">{job.contract.screens.map((s) => <li key={s.name} className="text-zinc-400"><span className="text-zinc-200 font-medium">{s.name}</span> — {s.purpose}</li>)}</ul>
                          </section>
                          <section>
                            <h4 className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 mb-2">API routes</h4>
                            <ul className="space-y-1.5 font-mono text-[11px]">{job.contract.apiRoutes.map((r) => <li key={`${r.method}${r.path}`} className="text-zinc-400"><span className="text-emerald-400">{r.method}</span> {r.path}</li>)}</ul>
                          </section>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {detailTab === 'log' && (
                  <div className="p-4 font-mono text-[11px] max-h-[620px] overflow-y-auto bg-black/30 space-y-1">
                    {job.events.length === 0 && <p className="text-zinc-600">No live log for this project (history only). Re-verify to stream a new run.</p>}
                    {job.events.map((ev, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="text-zinc-600 shrink-0">{new Date(ev.ts).toLocaleTimeString()}</span>
                        <span className="text-zinc-500 shrink-0 w-16 uppercase">{ev.stage}</span>
                        <span className={ev.level === 'error' ? 'text-rose-400' : ev.level === 'warn' ? 'text-amber-400' : ev.level === 'success' ? 'text-emerald-400' : 'text-zinc-300'}>{ev.message}</span>
                      </div>
                    ))}
                    {running && <div className="flex items-center gap-2 text-zinc-500 pt-1"><Loader2 className="h-3 w-3 animate-spin" /> working…</div>}
                    <div ref={logEndRef} />
                  </div>
                )}

                {detailTab === 'issues' && (
                  <div className="p-5">
                    {issues.length === 0 ? (
                      <p className="text-xs font-mono text-zinc-500 flex items-center gap-2">
                        {job.verification?.ok ? <><CheckCircle2 className="h-4 w-4 text-emerald-400" /> No issues — the compiler is clean.</> : 'Not verified yet.'}
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {issues.map((iss, i) => (
                          <li key={i} className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                            <p className="text-[11px] font-mono text-amber-300">{iss.file}{iss.line ? `:${iss.line}` : ''} <span className="text-zinc-500">{iss.code}</span></p>
                            <p className="text-xs text-zinc-300 mt-1">{iss.message}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
