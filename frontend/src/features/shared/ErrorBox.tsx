import { useTranslation } from 'react-i18next';
import { tr, displayMessage } from '../../i18n';
import { Button, Surface } from './ui';
export function ErrorBox({ error, retry }: { error: string; retry?: () => void }) {
  useTranslation();
  return (
    <Surface as="div" tone="danger" className="error-box" role="alert">
      <p>{displayMessage(error)}</p>
      {retry && <Button onClick={retry}>{tr('design-reference.tryAgain')}</Button>}
    </Surface>
  );
}
