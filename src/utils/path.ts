export const pathSeparator = typeof navigator !== "undefined" && /linux/i.test(navigator.userAgent) ? "/" : "\\";

export function joinDisplayPath(...parts: string[]): string {
  const separator = pathSeparator;
  return parts
    .filter(Boolean)
    .map((part, index) => {
      if (index === 0) return part.replace(/[\\/]+$/g, "");
      return part.replace(/^[\\/]+|[\\/]+$/g, "");
    })
    .join(separator);
}
