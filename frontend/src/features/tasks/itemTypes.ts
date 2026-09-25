import { tr } from '../../i18n';
export const types = {
  get checkbox() {
    return tr('itemTypes.checkbox');
  },
  get text() {
    return tr('itemTypes.text');
  },
  get number() {
    return tr('itemTypes.number');
  },
} as const;
