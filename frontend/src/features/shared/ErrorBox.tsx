import { useTranslation } from 'react-i18next';
import { tr, displayMessage } from '../../i18n';
import { Surface } from './/ui';
import { IconButton } from './IconButton';
export function ErrorBox({ error, retry }: { error: string; retry?: () => void }) {
  useTranslation();
  return (
    <Surface as="div" tone="danger" className="error-box" role="alert">
      <p>{displayMessage(error)}</p>
      {retry && (
        <IconButton icon="refresh" onClick={retry}>
          {tr('design-reference.tryAgain')}
        </IconButton>
      )}
    </Surface>
  );
}
