import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Input } from './/ui';
import { useId } from 'react';

export function TagInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  useTranslation();
  const hint = useId();
  return (
    <label className="wide">
      {tr('TagInput.tags')}
      <Input
        type="text"
        className="tag-input"
        aria-label={tr('TagInput.tags')}
        aria-describedby={hint}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={tr('TagInput.commaSeparatedEGLearningPersonal')}
      />
      <span id={hint} className="sr-only">
        {tr('TagInput.commaSeparatedUpTo20Tags50CharactersEach')}
      </span>
    </label>
  );
}
