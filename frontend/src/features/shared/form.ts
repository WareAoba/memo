import { LocalizedError } from '../../i18n/errors';
import { tr } from '../../i18n';
export function message(error: unknown) {
  if (error instanceof LocalizedError && error.messageKey) return error.messageKey;
  return error instanceof Error && error.message ? error.message : tr('form.requestFailedTryAgain');
}
export function go(path: string) {
  window.location.hash = path;
}
export function parseTags(value: string) {
  const tags = value
    .split(/[,\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (tags.length > 20 || tags.some((tag) => [...tag].length > 50))
    throw new LocalizedError('form.enterUpTo20TagsEachNoLongerThan');
  return tags;
}
