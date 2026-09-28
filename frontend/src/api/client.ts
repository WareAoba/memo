import { LocalizedError } from '../i18n/errors';
import { beginTrackWrite, currentTrackScope, isTrackRequest, trackHeaders } from './trackScope';
export class ApiError extends LocalizedError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function requestJson(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
  notFound = 'client.theRequestedItemCouldNotBeFound',
): Promise<unknown> {
  const scoped = isTrackRequest(path);
  const scope = currentTrackScope();
  const finish = scoped && method !== 'GET' ? beginTrackWrite() : () => {};
  try {
    const response = await fetch(path, {
      method,
      headers: {
        Accept: 'application/json',
        ...(scoped ? trackHeaders() : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      credentials: 'same-origin',
      cache: 'no-store',
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }).catch(() => {
      throw new LocalizedError('client.cannotConnectToTheServerCheckYourConnectionAnd');
    });
    if (scoped && scope !== currentTrackScope()) throw new LocalizedError('Tracks.changed');
    if (!response.ok) {
      if (response.status === 401) throw new ApiError('Auth.signInRequired', 401, 'UNAUTHORIZED');
      if (response.status === 409) {
        const body = await response.json().catch(() => undefined);
        const code = record(body) && record(body.error) ? body.error.code : undefined;
        throw new ApiError(
          code === 'TRACK_LIMIT'
            ? 'Tracks.limitReached'
            : code === 'REQUIREMENTS_INCOMPLETE'
              ? 'client.fillInAllRequiredFieldsBeforeCompleting'
              : code === 'EXECUTION_LOCKED'
                ? 'client.resumeTheCancelledScheduleBeforeRunningTasks'
                : 'client.theStatusHasChangedRefreshAndTryAgain',
          409,
          typeof code === 'string' ? code : undefined,
        );
      }
      // Do not render arbitrary server/proxy response bodies in the UI.
      throw new ApiError(
        response.status === 404
          ? notFound
          : response.status === 400
            ? 'client.checkYourInput'
            : 'client.theServerRequestFailed',
        response.status,
      );
    }
    if (response.status === 204) return undefined;
    try {
      const result: unknown = await response.json();
      if (scoped && scope !== currentTrackScope()) throw new LocalizedError('Tracks.changed');
      return result;
    } catch {
      throw new ApiError('client.couldNotReadTheServerResponse', response.status);
    }
  } finally {
    finish();
  }
}

export const getJson = (path: string, signal?: AbortSignal) =>
  requestJson(path, 'GET', undefined, signal);

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export type Page<T> = { items: T[]; total: number; limit: number; offset: number };
export function parsePage<T>(value: unknown, parse: (item: unknown) => T): Page<T> {
  if (
    !record(value) ||
    !Array.isArray(value.items) ||
    !['total', 'offset', 'limit'].every(
      (key) => Number.isInteger(value[key]) && Number(value[key]) >= 0,
    )
  )
    throw new LocalizedError('client.couldNotReadTheServerResponse');
  return {
    items: value.items.map(parse),
    total: Number(value.total),
    limit: Number(value.limit),
    offset: Number(value.offset),
  };
}
