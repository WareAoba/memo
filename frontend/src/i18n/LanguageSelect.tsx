import { useTranslation } from 'react-i18next';
import { Select } from '../features/shared/ui';
import { changeLanguage, currentLanguage, supportedLanguage, tr } from '.';

export function LanguageSelect() {
  useTranslation();
  return (
    <Select
      className="language-select"
      aria-label={tr('app.language')}
      title={tr('app.language')}
      value={currentLanguage()}
      onChange={(event) => {
        const language = supportedLanguage(event.target.value);
        if (language) void changeLanguage(language);
      }}
    >
      <option value="ko" lang="ko">
        한국어
      </option>
      <option value="en" lang="en">
        English
      </option>
      <option value="ja" lang="ja">
        日本語
      </option>
    </Select>
  );
}
