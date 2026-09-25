import { createContext, useContext } from 'react';
import { defaultSettings, type UserSettings } from '../../api/settings';

export type SettingsState = {
  values: UserSettings;
  loaded: boolean;
  saving: boolean;
  error: string;
  update: (patch: Partial<UserSettings>) => void;
  retry: () => void;
};
export const SettingsContext = createContext<SettingsState>({
  values: defaultSettings,
  loaded: false,
  saving: false,
  error: '',
  update: () => {},
  retry: () => {},
});
export const useSettings = () => useContext(SettingsContext);
