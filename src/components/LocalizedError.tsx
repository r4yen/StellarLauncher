import { useState } from "react";
import { useUiLanguage, useUiText } from "../uiLanguage";
import { errorSummary } from "../uiTranslation";

export default function LocalizedError({ message }: { message?: string }) {
  const language = useUiLanguage();
  const ui = useUiText();
  const [expanded, setExpanded] = useState(false);
  if (!message) return null;
  const summary = errorSummary(message, language);
  return <span className="localized-error"><span>{summary}</span>{summary !== message && <><button className="text-action" type="button" aria-expanded={expanded} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setExpanded(!expanded); }}>{ui("Technical details")}</button>{expanded && <code>{message}</code>}</>}</span>;
}
