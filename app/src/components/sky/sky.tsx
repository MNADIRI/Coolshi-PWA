"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

// One pastel sky, painted behind the whole feed. Each SkyWindow reveals
// its own slice. Adjacent cards appear to cut out of the same image.
const SKY_GRADIENT = `
  radial-gradient(80% 60% at 20% 5%, #F7D9D0 0%, transparent 55%),
  radial-gradient(70% 50% at 85% 15%, #F9E3C9 0%, transparent 60%),
  radial-gradient(90% 60% at 10% 30%, #F5EBC5 0%, transparent 60%),
  radial-gradient(80% 55% at 75% 45%, #D7E4CC 0%, transparent 60%),
  radial-gradient(90% 55% at 15% 58%, #CFE4DA 0%, transparent 62%),
  radial-gradient(85% 55% at 80% 68%, #D4E2EC 0%, transparent 60%),
  radial-gradient(90% 55% at 20% 82%, #D8D3EA 0%, transparent 62%),
  radial-gradient(90% 60% at 85% 92%, #E4D2DE 0%, transparent 62%),
  linear-gradient(180deg, #F7D9D0 0%, #F9E3C9 14%, #F5EBC5 28%, #D7E4CC 42%, #CFE4DA 56%, #D4E2EC 70%, #D8D3EA 84%, #E4D2DE 96%)
`;

type SkyCtx = { version: number };
const SkyContext = createContext<SkyCtx | null>(null);

interface SkyProviderProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

// Wraps the feed. SkyWindow children read the bounding rect of the nearest
// ancestor with data-sky-root to compute their slice.
export function SkyProvider({ children, className, style }: SkyProviderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const bump = () => setVersion((v) => v + 1);
    const ro = new ResizeObserver(bump);
    ro.observe(el);
    window.addEventListener("scroll", bump, true);
    window.addEventListener("resize", bump);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", bump, true);
      window.removeEventListener("resize", bump);
    };
  }, []);

  return (
    <SkyContext.Provider value={{ version }}>
      <div ref={ref} data-sky-root className={className} style={style}>
        {children}
      </div>
    </SkyContext.Provider>
  );
}

interface SkyWindowProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function SkyWindow({ className, style, children }: SkyWindowProps) {
  const ctx = useContext(SkyContext);
  const ref = useRef<HTMLDivElement>(null);
  const [bg, setBg] = useState({ x: 0, y: 0, w: 360, h: 2400 });

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const host = el.closest("[data-sky-root]") as HTMLElement | null;
      if (!host) return;
      const hostRect = host.getBoundingClientRect();
      const meRect = el.getBoundingClientRect();
      setBg({
        x: meRect.left - hostRect.left,
        y: meRect.top - hostRect.top,
        w: host.offsetWidth,
        h: host.offsetHeight,
      });
    };
    update();
    const id = window.setInterval(update, 150);
    return () => window.clearInterval(id);
  }, [ctx?.version]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: "relative",
        backgroundImage: SKY_GRADIENT,
        backgroundSize: `${bg.w}px ${bg.h}px`,
        backgroundPosition: `${-bg.x}px ${-bg.y}px`,
        backgroundRepeat: "no-repeat",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Independent pastel gradient art (for Library/Saved thumbnails — not tied to the feed sky).
const PASTEL_PAIRS = {
  rose: ["#F7D9D0", "#C8A2B8"],
  peach: ["#F9E3C9", "#D9B098"],
  butter: ["#F5EBC5", "#C9B77A"],
  sage: ["#D7E4CC", "#98AE8A"],
  mint: ["#CFE4DA", "#8AB0A0"],
  sky: ["#D4E2EC", "#8FAEC0"],
  iris: ["#D8D3EA", "#9A90BA"],
  mauve: ["#E4D2DE", "#AC90A4"],
  sand: ["#EDE4D2", "#BBA98F"],
  slate: ["#D8D8D4", "#95958E"],
} as const;

export type PastelHue = keyof typeof PASTEL_PAIRS;

export function PastelArt({
  hue,
  className,
  style,
}: {
  hue: PastelHue;
  className?: string;
  style?: CSSProperties;
}) {
  const [a, b] = PASTEL_PAIRS[hue];
  return (
    <div
      className={className}
      style={{
        background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
        ...style,
      }}
    />
  );
}
