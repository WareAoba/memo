import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { suggestUnmanaged } from '../../api/unmanagedPresets';
import { Button } from './ui';
import { ErrorBox } from './ErrorBox';
import { message } from './form';

export function UnmanagedSuggestions({
  kind,
  name,
  onSelect,
}: {
  kind: 'work' | 'task';
  name: string;
  onSelect: (name: string) => void;
}) {
  useTranslation();
  const [result, setResult] = useState<{ query: string; items: { id: string; name: string }[] }>();
  const [error, setError] = useState<{ query: string; value: string }>();
  const [attempt, setAttempt] = useState(0);
  const query = name.trim();
  useEffect(() => {
    if (!query) return;
    const c = new AbortController();
    const timer = setTimeout(() => {
      suggestUnmanaged(kind, query, c.signal)
        .then((items) => {
          if (!c.signal.aborted) {
            setResult({ query, items });
            setError(undefined);
          }
        })
        .catch((e) => {
          if (!c.signal.aborted) setError({ query, value: message(e) });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [kind, query, attempt]);
  const items = result?.query === query ? result.items : [];
  return (
    <div className="wide">
      {error?.query === query && (
        <ErrorBox error={error.value} retry={() => setAttempt((v) => v + 1)} />
      )}
      {items.length > 0 && (
        <>
          <p className="hint">{tr('Unmanaged.suggestion')}</p>
          {items.map((item) => (
            <Button key={item.id} variant="option" onClick={() => onSelect(item.name)}>
              {item.name}
            </Button>
          ))}
          {items.some((item) => item.name.toLowerCase() === query.toLowerCase()) && (
            <p role="status" className="hint">
              {tr('Unmanaged.promotion')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
