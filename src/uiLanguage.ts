import { createContext, useCallback, useContext } from "react";
import { translateUi, UiLocale } from "./uiTranslation";
export const UiLanguage = createContext<UiLocale>("en");
export const useUiLanguage = () => useContext(UiLanguage);
export function useUiText() {
  const language = useUiLanguage();
  return useCallback((text: string, values?: Record<string, string | number>) => translateUi(text, language, values), [language]);
}
