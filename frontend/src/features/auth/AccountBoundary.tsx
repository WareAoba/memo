import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getAccount, type Account } from '../../api/auth';
import { ApiError } from '../../api/client';
import { tr } from '../../i18n';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';

export function AccountBoundary({ children }: { children: (account: Account) => ReactNode }) {
  useTranslation();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void getAccount(controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) setAccount(value);
      },
      (reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof ApiError && reason.status === 401
              ? 'Auth.signInRequired'
              : message(reason),
          );
      },
    );
    return () => controller.abort();
  }, [attempt]);
  if (account) return children(account);
  return (
    <main aria-busy={!error}>
      {error ? (
        <ErrorBox
          error={error}
          retry={() => {
            setError('');
            setAttempt((value) => value + 1);
          }}
        />
      ) : (
        <p role="status">{tr('Auth.loading')}</p>
      )}
    </main>
  );
}
