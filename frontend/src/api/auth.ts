import { getJson, record } from './client';
import { LocalizedError } from '../i18n/errors';

export type Account = {
  id: string;
  display_name: string;
  email: string | null;
  picture?: string | null;
};
export async function getAccount(signal?: AbortSignal): Promise<Account> {
  const value = await getJson('/api/auth/me', signal);
  if (
    !record(value) ||
    !record(value.user) ||
    typeof value.user.id !== 'string' ||
    typeof value.user.display_name !== 'string' ||
    (value.user.email !== null && typeof value.user.email !== 'string') ||
    (value.user.picture != null && typeof value.user.picture !== 'string')
  ) {
    throw new LocalizedError('client.couldNotReadTheServerResponse');
  }
  return {
    id: value.user.id,
    display_name: value.user.display_name,
    email: value.user.email,
    picture: value.user.picture as string | null | undefined,
  };
}
