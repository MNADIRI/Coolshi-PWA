import type { CSSProperties, ReactNode } from "react";

export function Caption({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`font-text text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-3 ${className ?? ""}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function Sources({
  items,
  readTime,
  className,
}: {
  items: string[];
  readTime?: string | null;
  className?: string;
}) {
  if (!items.length) return null;
  // Preserve order but dedupe case-insensitive.
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const name of items) {
    const k = name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(name);
  }
  const text = readTime ? `${uniq.join("  ·  ")}  ·  ${readTime}` : uniq.join("  ·  ");
  return (
    <div
      className={`font-text text-[11px] font-medium tracking-[0.02em] text-ink-3 ${className ?? ""}`}
    >
      {text}
    </div>
  );
}
