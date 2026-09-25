import { ApiError, getJson } from './client';

export interface HealthResponse {
  status: 'ok';
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const data = await getJson('/api/health', signal);
  if (typeof data !== 'object' || data === null || !('status' in data) || data.status !== 'ok') {
    throw new ApiError('health.unexpectedServerResponse', 200);
  }
  return { status: 'ok' };
}
