import messages from "./uiMessages.json";

export type UiLocale = "en" | "de";
const catalog: Record<string, string> = messages;
const english = new Map(Object.entries(catalog).map(([en, de]) => [de, en]));
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const templates = Object.entries(catalog).filter(([key]) => /\{\w+\}/.test(key)).map(([key, value]) => {
  const names = [...key.matchAll(/\{(\w+)\}/g)].map(match => match[1]);
  return { names, value, pattern: new RegExp("^" + key.split(/\{\w+\}/).map(escape).join("(.+?)") + "$") };
});
export const hasUiMessage = (text: string) => catalog[text] !== undefined || english.has(text) || templates.some(template => template.pattern.test(text));

export function translateUi(text: string, language: UiLocale, values?: Record<string, string | number>): string {
  let translated = text;
  if (language === "en") translated = english.get(text) ?? text;
  if (language === "de") {
    if (catalog[text] !== undefined) translated = catalog[text];
    else {
      for (const template of templates) {
        const match = text.match(template.pattern);
        if (!match) continue;
        translated = template.value.replace(/\{(\w+)\}/g, (_, name: string) => {
          const value = match[template.names.indexOf(name) + 1];
          return name === "message" ? translateUi(value, language) : value;
        });
        break;
      }
    }
  }
  return values ? translated.replace(/\{(\w+)\}/g, (placeholder, key: string) => String(values[key] ?? placeholder)) : translated;
}

export function errorSummary(message: string, language: UiLocale): string {
  const clean = message.replace(/^Error:\s*/, "");
  const known = translateUi(clean, language);
  if (clean.startsWith("Could not check for updates.")) return translateUi("Could not check for updates. The launcher can still be used.", language);
  if (clean.startsWith("Automatic update could not finish.")) return translateUi("Automatic update could not finish.", language);
  if (catalog[clean] !== undefined || english.has(clean) || known !== clean) return known;
  const key = /cancel/i.test(clean) ? "Operation cancelled."
    : /unsupported|cannot.*import/i.test(clean) ? "This instance cannot be imported. Check the technical details."
    : /network|connect|download|request|fetch|dns|timeout/i.test(clean) ? "Check your connection and try again."
    : /token|login|sign.in|account|unauthorized/i.test(clean) ? "Sign in again and retry."
    : /permission|disk|space|access.*denied|cannot.*(write|create)/i.test(clean) ? "Check the folder permissions and available disk space."
    : "Something went wrong. Please try again.";
  return translateUi(key, language);
}
