import { LocalizedError } from '../../i18n/errors';
import { useEffect, useState } from 'react';
import { requestJson } from '../../api/client';
import { message } from './form';
export function useNames(path: string, revision = 0) {
  const [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    requestJson(path, 'GET', undefined, controller.signal)
      .then((v) => {
        if (!Array.isArray(v) || !v.every((x) => typeof x === 'string'))
          throw new LocalizedError('useNames.couldNotLoadTheList');
        if (!controller.signal.aborted) {
          setNames(v);
          setError('');
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e));
      });
    return () => controller.abort();
  }, [path, revision]);
  return { names, error };
}
