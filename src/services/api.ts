/**
 * Core API Dispatch Utility
 * Handles strict bidirectional communication with the Node.js Orchestration Gateway.
 */
export const dispatchTask = async (directive: string, agentRole: string) => {
  // Initialize a circuit breaker to prevent infinite UI hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second strict timeout

  try {
    // Dynamic routing: reads Vercel environment variable in production, localhost in development
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    
    const response = await fetch(`${API_BASE_URL}/api/orchestrator/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ directive, agentRole }),
      signal: controller.signal // Bind the abort signal to the fetch request
    });

    clearTimeout(timeoutId); // Clear the timeout if the server responds

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Gateway execution failed with status: ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[API BOUNDARY ERROR] Request timed out.');
      throw new Error(
        '[GUARD FIREWALL] Gateway Timeout: The orchestration pipeline took too long to respond or the network connection dropped.',
        { cause: error }
      );
    }

    console.error('[API BOUNDARY ERROR] Failed to dispatch task:', error);
    throw error;
  }
};