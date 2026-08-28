// Verified Cloud Run Gateway Endpoint
const BACKEND_URL = 'https://nexus-7-backend-ssuzn77t2q-ew.a.run.app';

// Sanitize URL to ensure no accidental brackets, whitespace, or trailing slashes
const CLEAN_BASE_URL = (import.meta.env.VITE_API_URL || BACKEND_URL)
  .toString()
  .replace(/[[\]"'\s]/g, '')
  .replace(/\/+$/, '');

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
  status: string;
  latency_ms: number;
  created_at: string;
}

export interface TelemetryResponse {
  success: boolean;
  count: number;
  logs: TelemetryLog[];
}

/**
 * Dispatches an architectural or audit directive to the Gemini agent core
 */
export const dispatchTask = async (
  directive: string,
  agentRole: string = 'Gateway Router & Dispatcher'
): Promise<DispatchResponse> => {
  const targetUrl = `${CLEAN_BASE_URL}/api/orchestrator/dispatch`;

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        directive,
        agentRole,
        tenantId: 'tenant_admin_muni_01',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[GATEWAY ERROR ${response.status}] ${errorText}`);
    }

    const data: DispatchResponse = await response.json();
    return data;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown execution error occurred';
    console.error('[API DISPATCH FAILED]', message);
    throw new Error(message, { cause: err });
  }
};

// Backwards compatibility alias
export const dispatchDirective = dispatchTask;

/**
 * Fetches persisted telemetry and latency logs from Cloud SQL PostgreSQL
 */
export const fetchTelemetryLogs = async (limit: number = 50): Promise<TelemetryResponse> => {
  const targetUrl = `${CLEAN_BASE_URL}/api/orchestrator/telemetry?tenantId=tenant_admin_muni_01&limit=${limit}`;

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[TELEMETRY FETCH ERROR ${response.status}] ${errorText}`);
    }

    const data: TelemetryResponse = await response.json();
    return data;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve telemetry buffer';
    console.error('[TELEMETRY BUFFER FAILED]', message);
    throw new Error(message, { cause: err });
  }
};