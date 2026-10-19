/**
 * Nexus-7 API client.
 * Default: same-origin requests ('/api/...'). In dev, Vite proxies /api and /preview to the local backend
 * (http://localhost:8080); in one-process mode the backend serves this UI itself.
 * Set VITE_API_URL only if the backend lives somewhere else.
 */
const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export const TENANT_ID = 'tenant_admin_muni_01';

export const apiUrl = (path: string) => `${BASE_URL}${path}`;

/** Fired when the backend says an access key is needed (network mode). App.tsx shows the login gate. */
export const AUTH_EVENT = 'nexus-auth-required';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      credentials: 'same-origin',
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
  } catch (err) {
    throw new Error('[GATEWAY OFFLINE] Cannot reach the local Nexus-7 backend. Is it running on http://localhost:8080?', { cause: err });
  }

  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (response.status === 401 && body && typeof body === 'object' && 'authRequired' in body) {
    window.dispatchEvent(new Event(AUTH_EVENT));
  }

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : text || response.statusText;
    throw new Error(`[GATEWAY ERROR ${response.status}] ${message}`);
  }
  return body as T;
}

// ---------------------------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------------------------

export interface HealthResponse {
  status: string;
  authRequired?: boolean;
  networkMode?: boolean;
  models?: { chat: string; factory: string; pro: string };
  pricing?: Record<'flash' | 'pro' | 'lite', { input: number; output: number }>;
  engine: string;
  llmConfigured: boolean;
  database: { driver: string; ready: boolean; latencyMs: number | null };
  guard: { max: number; windowMs: number; maxDirectiveChars: number };
  factory: { workspace: string; maxTransitions: number };
  platform: string;
  uptimeSeconds: number;
}

export const fetchHealth = () => request<HealthResponse>('/api/health');

export const fetchAuthStatus = () =>
  request<{ required: boolean; authenticated: boolean; networkMode: boolean }>('/api/auth/status');
export const login = (key: string) => request<{ success: boolean }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ key }) });
export const logout = () => request<{ success: boolean }>('/api/auth/logout', { method: 'POST' });

// ---------------------------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------------------------

export interface DispatchResponse {
  success: boolean;
  data: string;
  latencyMs: number;
  status: string;
}

export interface TelemetryLog {
  id: string;
  tenant_id: string;
  agent_role: string;
  action: string;
  directive: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | string;
  latency_ms: number;
  created_at: string;
}

export interface TelemetryResponse {
  success: boolean;
  count: number;
  logs: TelemetryLog[];
}

export interface AgentStat {
  agentRole: string;
  runs: number;
  successRate: number | null;
  avgLatencyMs: number | null;
}

export interface StatsResponse {
  success: boolean;
  agents: AgentStat[];
  totals: { events: number; blocked: number; failed: number };
}

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export const dispatchTask = (
  directive: string,
  agentRole = 'Code Reviewer',
  options: { history?: ChatTurn[]; projectId?: string | null } = {}
) =>
  request<DispatchResponse>('/api/orchestrator/dispatch', {
    method: 'POST',
    body: JSON.stringify({ directive, agentRole, tenantId: TENANT_ID, history: options.history || [], projectId: options.projectId || undefined }),
  });

export const dispatchDirective = dispatchTask;

export const fetchTelemetryLogs = (limit = 50, status?: string) =>
  request<TelemetryResponse>(
    `/api/orchestrator/telemetry?tenantId=${TENANT_ID}&limit=${limit}${status ? `&status=${encodeURIComponent(status)}` : ''}`
  );

export const fetchStats = () => request<StatsResponse>(`/api/orchestrator/stats?tenantId=${TENANT_ID}`);

// ---------------------------------------------------------------------------------------------
// App Factory
// ---------------------------------------------------------------------------------------------

export type StageId = 'contract' | 'agents' | 'scaffold' | 'verify' | 'repair' | 'build';
export type StageStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'needs_attention' | 'failed';

export interface JobEvent {
  ts: string;
  level: 'info' | 'warn' | 'error' | 'success';
  stage: StageId | 'system';
  message: string;
}

export interface VerificationIssue {
  file: string;
  line?: number;
  code?: string;
  message: string;
}

export interface FactoryContract {
  appName: string;
  slug: string;
  summary: string;
  entities: Array<{ name: string; fields: Array<{ name: string; type: string }> }>;
  modules: Array<{ path: string; owner: string; exports: string; purpose?: string }>;
  screens: Array<{ name: string; purpose: string }>;
  apiRoutes: Array<{ method: string; path: string; purpose: string }>;
}

export interface FactoryJob {
  id: string;
  name: string;
  brief: string;
  status: JobStatus;
  projectDir: string;
  stages: Record<StageId, StageStatus>;
  transitions: number;
  events: JobEvent[];
  contract?: FactoryContract;
  verification?: { mode: 'syntax' | 'full'; ok: boolean; issues: VerificationIssue[]; tests?: { passed: number; failed: number } };
  previewReady: boolean;
  previewPath?: string;
  redactions: number;
  tier?: ModelTier;
  usage?: UsageTotals;
  timings?: Record<string, number>;
  run?: RunState | null;
  apk?: ApkState | null;
  createdAt: string;
  finishedAt?: string;
  error?: string;
}

export type ModelTier = 'flash' | 'pro';
export type BuildMode = 'auto' | 'staged' | 'single';

export interface UsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  models: string[];
}

export interface RunState {
  status: 'installing' | 'starting' | 'running' | 'stopped' | 'failed';
  port?: number;
  url?: string;
  startedAt: string;
  logs: string[];
  error?: string;
}

export interface ApkState {
  status: 'running' | 'succeeded' | 'failed';
  step: string;
  startedAt: string;
  finishedAt?: string;
  logs: string[];
  apkFile?: string;
  error?: string;
}

export interface GitCommit {
  hash: string;
  date: string;
  subject: string;
}

export interface BriefTemplate {
  id: string;
  name: string;
  brief: string;
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  brief: string;
  status: JobStatus;
  projectDir: string;
  fileCount: number;
  previewReady: boolean;
  costUsd?: number;
  tier?: ModelTier;
  createdAt: string;
}

export const startFactoryRun = (brief: string, appName: string, verify: 'full' | 'syntax', tier: ModelTier = 'flash', buildMode: BuildMode = 'auto') =>
  request<{ success: boolean; job: FactoryJob }>('/api/factory/projects', {
    method: 'POST',
    body: JSON.stringify({ brief, appName, verify, tier, buildMode, tenantId: TENANT_ID }),
  });

/**
 * Live job updates over Server-Sent Events. Returns a close() function.
 * onError fires if the stream drops so the caller can fall back to polling.
 */
export const streamJob = (id: string, onJob: (job: FactoryJob) => void, onError: () => void) => {
  const source = new EventSource(apiUrl(`/api/factory/projects/${id}/stream`), { withCredentials: true });
  source.onmessage = (event) => {
    try {
      onJob(JSON.parse(event.data) as FactoryJob);
    } catch {
      /* ignore malformed frame */
    }
  };
  source.onerror = () => {
    source.close();
    onError();
  };
  return () => source.close();
};

export const fetchProjects = () =>
  request<{ success: boolean; workspace: string; projects: ProjectSummary[] }>('/api/factory/projects');

export const fetchJob = (id: string) =>
  request<{ success: boolean; job: FactoryJob; eventCount: number }>(`/api/factory/projects/${id}`);

export const fetchProjectFiles = (id: string) =>
  request<{ success: boolean; files: string[] }>(`/api/factory/projects/${id}/files`);

export const fetchProjectFile = (id: string, path: string) =>
  request<{ success: boolean; path: string; content: string }>(
    `/api/factory/projects/${id}/file?path=${encodeURIComponent(path)}`
  );

/** Generate missing files of an unfinished build, then verify, repair and build. */
export const continueProjectBuild = (id: string) =>
  request<{ success: boolean; job: FactoryJob }>(`/api/factory/projects/${id}/continue`, { method: 'POST' });

export const reverifyProject = (id: string) =>
  request<{ success: boolean; job: FactoryJob }>(`/api/factory/projects/${id}/verify`, { method: 'POST' });

export const openProjectFolder = (id: string) =>
  request<{ success: boolean; path: string }>(`/api/factory/projects/${id}/open`, { method: 'POST' });

export const exportUrl = (id: string) => apiUrl(`/api/factory/projects/${id}/export.zip`);
export const previewUrl = (job: Pick<FactoryJob, 'previewPath'>) => apiUrl(job.previewPath || '');

export interface GithubInfo {
  owner: string;
  repo: string;
  url: string;
  private: boolean;
  pushedAt: string;
  commit: string | null;
}

export const fetchGitLog = (id: string) =>
  request<{ success: boolean; commits: GitCommit[]; github: GithubInfo | null; githubConfigured: boolean }>(`/api/factory/projects/${id}/git`);

export const publishToGithub = (id: string, opts: { repoName?: string; private?: boolean } = {}) =>
  request<{ success: boolean; github: GithubInfo; commits: GitCommit[] }>(`/api/factory/projects/${id}/github`, {
    method: 'POST',
    body: JSON.stringify(opts),
  });

export const runProject = (id: string) => request<{ success: boolean; run: RunState }>(`/api/factory/projects/${id}/run`, { method: 'POST' });
export const stopProject = (id: string) => request<{ success: boolean; run: RunState | null }>(`/api/factory/projects/${id}/stop`, { method: 'POST' });
export const fetchRunState = (id: string) => request<{ success: boolean; run: RunState | null }>(`/api/factory/projects/${id}/run`);

export const fetchAndroidToolchain = () =>
  request<{ success: boolean; ready: boolean; javaHome: string | null; sdkDir: string | null }>('/api/factory/android/toolchain');
export const buildApk = (id: string) => request<{ success: boolean; apk: ApkState }>(`/api/factory/projects/${id}/apk`, { method: 'POST' });
export const fetchApkState = (id: string) =>
  request<{ success: boolean; apk: ApkState | null; available: boolean; file: string | null }>(`/api/factory/projects/${id}/apk`);
export const apkDownloadUrl = (id: string) => apiUrl(`/api/factory/projects/${id}/apk/download`);

/** Upload a spec document and get a factory brief back (long documents are condensed by the model). */
export const briefFromFile = async (file: File) =>
  request<{ success: boolean; text: string; condensed: boolean; originalChars: number; fileName: string }>('/api/factory/briefs/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
    body: await file.arrayBuffer(),
  });

export const fetchTemplates = () => request<{ success: boolean; templates: BriefTemplate[] }>('/api/factory/briefs/templates');
export const saveTemplate = (name: string, brief: string) =>
  request<{ success: boolean; template: BriefTemplate }>('/api/factory/briefs/templates', {
    method: 'POST',
    body: JSON.stringify({ name, brief }),
  });
export const deleteTemplate = (id: string) => request<{ success: boolean }>(`/api/factory/briefs/templates/${id}`, { method: 'DELETE' });

export interface RefineSnapshot {
  id: string;
  instruction: string;
  summary: string;
  createdAt: string;
  files: number;
}

export const refineProject = (id: string, instruction: string) =>
  request<{ success: boolean; job: FactoryJob }>(`/api/factory/projects/${id}/refine`, {
    method: 'POST',
    body: JSON.stringify({ instruction, tenantId: TENANT_ID }),
  });

export const fetchRefineHistory = (id: string) =>
  request<{ success: boolean; history: RefineSnapshot[] }>(`/api/factory/projects/${id}/history`);

export const undoRefine = (id: string) =>
  request<{ success: boolean; job: FactoryJob }>(`/api/factory/projects/${id}/undo`, { method: 'POST' });

export const deleteProject = (id: string) =>
  request<{ success: boolean }>(`/api/factory/projects/${id}`, { method: 'DELETE' });

export const deleteFailedProjects = () =>
  request<{ success: boolean; deleted: number }>('/api/factory/projects?status=failed', { method: 'DELETE' });
