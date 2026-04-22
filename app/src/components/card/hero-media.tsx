import { SkyWindow } from "@/components/sky/sky";

interface Props {
  imageUrl?: string | null;
  title: string;
  kicker?: string | null;
  style?: React.CSSProperties;
  className?: string;
  compact?: boolean;
}

export function HeroMedia({ imageUrl, title, kicker, style, className, compact }: Props) {
  const hasImage = Boolean(imageUrl);
  return (
    <div
      className={`relative overflow-hidden ${className ?? ""}`}
      style={style}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl!}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <SkyWindow className="absolute inset-0" />
      )}
      {/* contrast scrim: bottom gradient fades to near-black for text legibility */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: compact ? "65%" : "58%",
          background:
            "linear-gradient(to top, rgba(12,12,10,0.72) 0%, rgba(12,12,10,0.48) 38%, rgba(12,12,10,0) 100%)",
        }}
      />
      <div
        className={`relative z-10 flex h-full flex-col justify-end ${
          compact ? "px-3.5 pb-3.5 pt-3" : "px-[22px] pb-[22px] pt-6"
        }`}
      >
        {kicker && (
          <div
            className={`mb-1.5 font-text font-semibold uppercase tracking-[0.18em] text-white/80 ${
              compact ? "text-[9px]" : "text-[10.5px]"
            }`}
          >
            {kicker}
          </div>
        )}
        <div
          className={`font-display font-semibold leading-[1.12] tracking-[-0.025em] text-white [text-wrap:balance] ${
            compact ? "text-[14px]" : "text-[22px]"
          }`}
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
        >
          {title}
        </div>
      </div>
    </div>
  );
}
