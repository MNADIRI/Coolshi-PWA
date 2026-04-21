# Coolshi — Worker (macOS)

Python 3.12 worker that runs on your Mac via `launchd`, fetches Tier C/D sources, and pushes `raw_items` to Supabase every 2h.

## Install

```bash
cd worker
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
cp .env.example .env
# Fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
```

## Bootstrap a source

Run this once per connector. The Chromium window that opens is for you to log in manually. When you close it, the session is encrypted with an AES-256 key stored in your macOS Keychain.

```bash
python bootstrap.py --source instagram
python bootstrap.py --source linkedin --name "LinkedIn"
python bootstrap.py --source x_twitter --name "X"
python bootstrap.py --source press_paywall --name "Le Monde" \
    --config configs/lemonde.json
```

Example `configs/lemonde.json`:

```json
{
  "login_url": "https://www.lemonde.fr/connexion/",
  "homepage": "https://www.lemonde.fr/",
  "article_link_selector": "a[href*='/article/']",
  "title_selector": "h1",
  "content_selector": "article",
  "max_articles": 15
}
```

**Tier D (Elsevier, Springer)** doesn't need `bootstrap.py` — the connector reads cookies directly from your logged-in Chrome/Firefox/Safari. Just add the row to `sources` manually:

```sql
insert into sources (source_type, source_tier, name, config, is_active) values (
  'elsevier', 'D', 'Elsevier — Radiomics',
  '{"search_url": "https://www.sciencedirect.com/search?qs=radiomics", "max_articles": 10}',
  true
);
```

## launchd

```bash
bash bin/install-launchd.sh
launchctl list | grep coolshi      # shows PID + exit status
tail -f logs/worker.log
```

Uninstall:

```bash
launchctl unload ~/Library/LaunchAgents/com.coolshi.worker.plist
```

Force the Mac to wake before the Routine's 7h run (optional, requires being plugged in):

```bash
sudo pmset repeat wake MTWRFSU 06:55:00
```

## Session expiry

Sessions typically last 1–30 days. When a connector errors with an auth-looking exception, `sources.last_error` records it — you'll see it in the PWA or by querying `sources`. Re-run `python bootstrap.py --source <name>` to refresh.

## Layout

```
worker/
├── main.py                   asyncio entrypoint
├── scheduler.py              APScheduler (2h interval + jitter)
├── config.py                 env + paths
├── bootstrap.py              interactive source setup
├── connectors/
│   ├── base.py               SourceConnector ABC + PlaywrightConnectorBase
│   ├── instagram.py          instagrapi
│   ├── linkedin.py           Playwright + storage_state
│   ├── x_twitter.py          idem
│   ├── tiktok.py             idem
│   ├── press_paywall.py      generic, config JSON per source
│   ├── elsevier.py           Tier D via browser_cookie3
│   ├── springer.py           Tier D
│   └── generic_auth_rss.py   authenticated RSS
├── storage/
│   ├── supabase_client.py    upsert raw_items, source status
│   └── sessions/             encrypted storage_state files
├── credentials/
│   └── keychain_adapter.py   AES-GCM + keyring
├── launchd/
│   └── com.coolshi.worker.plist
├── bin/
│   └── install-launchd.sh
└── logs/                     worker.log, worker.err.log
```

## Notes

- The worker pauses when the Mac sleeps and resumes on wake. If you want a guaranteed 7h/12h run, use the `pmset` command above.
- `keyring` falls back to a file under `~/.coolshi-keys` on non-macOS systems so the code stays testable in CI. On macOS it uses the real Keychain.
- Sessions are encrypted on disk with AES-256-GCM; only the symmetric key lives in Keychain.
