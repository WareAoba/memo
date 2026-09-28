import { useEffect, useState } from 'react';
import { getNames } from '../../api/names';
import { message } from './form';
export function useNames(path: string, revision = 0) {
  const [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    getNames(path, controller.signal)
      .then((v) => {
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
