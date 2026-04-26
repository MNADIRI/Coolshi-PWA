-- 0002_public_slugs.sql
-- Public sharing surface: adds public_slug + is_public to feed_cards.
-- Powers /c/{slug} public card pages and the Share button OG image.
-- Applied via Supabase MCP as `feed_cards_add_public_slug_and_is_public`.

-- 1. 10-char URL-safe base62 ID generator (62^10 = 8.4e17 combinations).
CREATE OR REPLACE FUNCTION coolshi_short_id()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  bytes bytea := gen_random_bytes(10);
  i int;
BEGIN
  FOR i IN 0..9 LOOP
    result := result || substr(alphabet, (get_byte(bytes, i) % 62) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 2. Columns. Nullable first so backfill can populate without conflict.
ALTER TABLE feed_cards
  ADD COLUMN public_slug text,
  ADD COLUMN is_public boolean NOT NULL DEFAULT true;

-- 3. Backfill existing rows (one slug per row).
UPDATE feed_cards SET public_slug = coolshi_short_id() WHERE public_slug IS NULL;

-- 4. Lock down for future rows.
ALTER TABLE feed_cards
  ALTER COLUMN public_slug SET NOT NULL,
  ALTER COLUMN public_slug SET DEFAULT coolshi_short_id();

CREATE UNIQUE INDEX feed_cards_public_slug_key ON feed_cards (public_slug);

-- 5. Anonymous SELECT for the public sharing surface.
--    The /c/{slug} route uses the Supabase anon client; this policy lets it
--    read public cards. is_public is a per-card kill switch.
CREATE POLICY feed_cards_public_select ON feed_cards
  FOR SELECT
  TO anon
  USING (is_public = true AND public_slug IS NOT NULL);
