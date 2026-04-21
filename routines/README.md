# Claude Code Routines

## coolshi-briefing

The curator Routine. Runs on Anthropic's infrastructure on a cron `0 7,12 * * *`, reads `raw_items` via the Supabase MCP, performs WebSearch/WebFetch for coverage gaps, and writes up to 30 `feed_cards` per batch.

### Install

```bash
mkdir -p ~/.claude/routines
cp -r coolshi-briefing ~/.claude/routines/
```

### MCP servers required

Configure in Claude Code settings (`~/.claude/settings.json` or the IDE extension):

- **Supabase MCP** — give it `SUPABASE_URL` + the **service role key** (not anon). The Routine needs write access to `feed_cards`, `raw_items`, and `agent_runs`.
- **Gmail MCP** — Google OAuth, for Tier A Gmail ingestion
- **Notion MCP** — for notes/brief references
- Optional: **ArXiv**, **PubMed**, **Slack**, **YouTube** MCPs depending on your brief

### Schedule

```bash
# Run manually first to validate
claude routine run coolshi-briefing

# Then set the cron via your routine config
# (exact syntax depends on your Claude Code version)
```

### Verify

```sql
-- Should be ≤ 30 rows, only from the latest batch_id
select count(*), batch_id from feed_cards
 where created_at > now() - interval '6 hours'
 group by batch_id;

-- Most recent run metadata
select * from agent_runs order by started_at desc limit 1;

-- Anything the Routine didn't use from the worker
select count(*) from raw_items where processed_in_batch is null;
```
