const RTF = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return RTF.format(-mins, "minute");
  const hours = Math.round(mins / 60);
  if (hours < 24) return RTF.format(-hours, "hour");
  const days = Math.round(hours / 24);
  return RTF.format(-days, "day");
}

export function sourceList(sources: { name: string }[]): string {
  return sources.map((s) => s.name).join(" · ");
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
