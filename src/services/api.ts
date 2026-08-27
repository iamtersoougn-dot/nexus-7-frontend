const BASE_URL = import.meta.env.VITE_API_URL || 'https://nexus-7-backend-55811069406.europe-west1.run.app';

export interface DispatchResponse {
  success: boolean;
  data: string;
  latencyMs: number;
  status: string;
}

export const dispatchDirective = async (directive: string, agentRole: string): Promise<DispatchResponse> => {
  // Strip trailing slashes to prevent double slashes in the route path
  const sanitizedBaseUrl = BASE_URL.replace(/\/+$/, '');
  const targetUrl = `${sanitizedBaseUrl}/api/orchestrator/dispatch`;

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        directive,
        agentRole,
        tenantId: 'tenant_admin_muni_01'
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