import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";
import { fixtureCards } from "@/lib/fixtures/cards";
import type { Database } from "@/lib/supabase/database.types";

// Node.js runtime (Fluid Compute) — Edge has a 1 MB function-size cap which
// the bundled sky PNGs blow past. Node has 250 MB headroom and is Vercel's
// recommended default.
export const runtime = "nodejs";

const USE_FIXTURES = process.env.NEXT_PUBLIC_USE_FIXTURES === "1";

type OgCardSubset = {
  title: string;
  synthesis: string;
  sources: Array<{ url: string; name: string }>;
  hero_image_url: string | null;
  tags: string[] | null;
  card_type: string | null;
};

async function loadCard(slug: string): Promise<OgCardSubset | null> {
  if (USE_FIXTURES) {
    const row = fixtureCards.find((c) => c.public_slug === slug);
    if (!row) return null;
    return {
      title: row.title,
      synthesis: row.synthesis,
      sources: row.sources,
      hero_image_url: row.hero_image_url,
      tags: row.tags,
      card_type: row.card_type,
    };
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("feed_cards")
    .select(
      "title, synthesis, sources, hero_image_url, tags, card_type",
    )
    .eq("public_slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as OgCardSubset;
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://coolshi-orpin.vercel.app";

const ARCHIVO_MEDIUM_URL = new URL(
  "../../../../../../public/fonts/og/Archivo-Medium.ttf",
  import.meta.url,
);
const ARCHIVO_SEMIBOLD_URL = new URL(
  "../../../../../../public/fonts/og/Archivo-SemiBold.ttf",
  import.meta.url,
);
const SPACE_GROTESK_MEDIUM_URL = new URL(
  "../../../../../../public/fonts/og/SpaceGrotesk-Medium.ttf",
  import.meta.url,
);
const SPACE_GROTESK_SEMIBOLD_URL = new URL(
  "../../../../../../public/fonts/og/SpaceGrotesk-SemiBold.ttf",
  import.meta.url,
);
const SKY_SQUARE_URL = new URL(
  "../../../../../../public/og/sky-square.png",
  import.meta.url,
);
const SKY_STORY_URL = new URL(
  "../../../../../../public/og/sky-story.png",
  import.meta.url,
);

async function fetchBuffer(url: URL): Promise<ArrayBuffer> {
  const res = await fetch(url);
  return res.arrayBuffer();
}

function bufferToDataUrl(buf: ArrayBuffer, mime: string): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function kickerFor(row: {
  tags: string[] | null;
  card_type: string | null;
}): string {
  const primary =
    row.tags?.[0] ?? (row.card_type === "deep_dive" ? "DEEP DIVE" : "BRIEF");
  return row.card_type === "deep_dive"
    ? `DEEP DIVE · ${primary.toUpperCase()}`
    : primary.toUpperCase();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.7 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const reqUrl = new URL(req.url);
  const format =
    reqUrl.searchParams.get("format") === "story" ? "story" : "square";

  const row = await loadCard(slug);
  if (!row) {
    return new Response("Not found", { status: 404 });
  }

  const [
    archivoMedium,
    archivoSemiBold,
    spaceGroteskMedium,
    spaceGroteskSemiBold,
    skyBuf,
  ] = await Promise.all([
    fetchBuffer(ARCHIVO_MEDIUM_URL),
    fetchBuffer(ARCHIVO_SEMIBOLD_URL),
    fetchBuffer(SPACE_GROTESK_MEDIUM_URL),
    fetchBuffer(SPACE_GROTESK_SEMIBOLD_URL),
    fetchBuffer(format === "story" ? SKY_STORY_URL : SKY_SQUARE_URL),
  ]);
  const skyDataUrl = bufferToDataUrl(skyBuf, "image/png");

  const publicUrl = `${SITE_URL}/c/${slug}`;
  // Use SVG output (pure JS, no canvas dependency — Edge-compatible).
  const qrSvg = await QRCode.toString(publicUrl, {
    errorCorrectionLevel: "H",
    margin: 0,
    width: 280,
    color: { dark: "#0E0E0D", light: "#00000000" },
    type: "svg",
  });
  const qrDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}`;

  const sourceNames =
    (row.sources as Array<{ url: string; name: string }>)?.map((s) => s.name) ??
    [];
  const kicker = kickerFor({ tags: row.tags, card_type: row.card_type });
  const synthesisText = truncate(row.synthesis, format === "story" ? 280 : 200);
  const sourcesLine = sourceNames.slice(0, 3).join("  ·  ");

  const dims =
    format === "story"
      ? { width: 1080, height: 1920 }
      : { width: 1080, height: 1080 };

  const heroHeight = format === "story" ? 1180 : 600;
  const titleSize = format === "story" ? 72 : 56;
  const synthesisSize = format === "story" ? 38 : 32;
  const sourcesSize = format === "story" ? 22 : 18;
  const footerHeight = format === "story" ? 154 : 110;
  const qrSize = format === "story" ? 140 : 100;

  const jsx = (
    <div
      style={{
        width: dims.width,
        height: dims.height,
        display: "flex",
        flexDirection: "column",
        background: "#F4F1EA",
      }}
    >
      {/* HERO */}
      <div
        style={{
          width: dims.width,
          height: heroHeight,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        {row.hero_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.hero_image_url}
            alt=""
            width={dims.width}
            height={heroHeight}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: dims.width,
              height: heroHeight,
              objectFit: "cover",
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={skyDataUrl}
            alt=""
            width={dims.width}
            height={heroHeight}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: dims.width,
              height: heroHeight,
              objectFit: "cover",
            }}
          />
        )}
        {/* contrast scrim */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "58%",
            background:
              "linear-gradient(to top, rgba(12,12,10,0.78) 0%, rgba(12,12,10,0.50) 38%, rgba(12,12,10,0) 100%)",
            display: "flex",
          }}
        />
        {/* kicker + title */}
        <div
          style={{
            position: "relative",
            padding: format === "story" ? "0 64px 64px 64px" : "0 48px 48px 48px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontFamily: "SpaceGrotesk",
              fontSize: format === "story" ? 22 : 18,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.85)",
              marginBottom: 18,
              display: "flex",
            }}
          >
            {kicker}
          </div>
          <div
            style={{
              fontFamily: "Archivo",
              fontSize: titleSize,
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              color: "#fff",
              textShadow: "0 2px 4px rgba(0,0,0,0.35)",
              display: "flex",
            }}
          >
            {row.title}
          </div>
        </div>
      </div>

      {/* TEXT BLOCK */}
      <div
        style={{
          flex: 1,
          background: "#F4F1EA",
          padding:
            format === "story" ? "64px 80px 0 80px" : "44px 64px 0 64px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontFamily: "SpaceGrotesk",
            fontSize: synthesisSize,
            fontWeight: 500,
            lineHeight: 1.42,
            color: "#1a1a17",
            marginBottom: format === "story" ? 48 : 28,
            display: "flex",
          }}
        >
          {synthesisText}
        </div>
        {sourcesLine && (
          <div
            style={{
              fontFamily: "SpaceGrotesk",
              fontSize: sourcesSize,
              fontWeight: 500,
              color: "#7a7a73",
              letterSpacing: "0.02em",
              display: "flex",
            }}
          >
            {sourcesLine}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div
        style={{
          height: footerHeight,
          borderTop: "1px solid #d4d2cd",
          display: "flex",
          alignItems: "center",
          padding: format === "story" ? "0 80px" : "0 64px",
          background: "#F4F1EA",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt=""
          width={qrSize}
          height={qrSize}
          style={{ display: "block", marginRight: 24 }}
        />
        <div
          style={{
            fontFamily: "SpaceGrotesk",
            fontSize: format === "story" ? 36 : 28,
            fontWeight: 500,
            color: "#1a1a17",
            display: "flex",
          }}
        >
          via coolshi
        </div>
      </div>
    </div>
  );

  return new ImageResponse(jsx, {
    width: dims.width,
    height: dims.height,
    fonts: [
      { name: "Archivo", data: archivoMedium, weight: 500, style: "normal" },
      { name: "Archivo", data: archivoSemiBold, weight: 600, style: "normal" },
      {
        name: "SpaceGrotesk",
        data: spaceGroteskMedium,
        weight: 500,
        style: "normal",
      },
      {
        name: "SpaceGrotesk",
        data: spaceGroteskSemiBold,
        weight: 600,
        style: "normal",
      },
    ],
    headers: {
      "Cache-Control":
        "public, max-age=31536000, immutable, s-maxage=31536000",
    },
  });
}
