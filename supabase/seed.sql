-- Default brief (spec §7): three-layer markdown stub so the /brief editor has
-- something to open on first run. Replace with your own content.

insert into briefs (content, anchor_articles, is_active) values (
$brief$
# Brief personnel

## Couche 1 — Domaines d'intérêt

Écris ici 300-800 mots de prose libre : ce qui t'intéresse, ce qui ne t'intéresse pas,
ton niveau d'expertise par domaine, le type d'angle que tu préfères (technique vs stratégique,
analyse vs news brute, etc.).

Inclus aussi les anti-intérêts — sujets à éviter explicitement même s'ils sont très couverts
dans tes sources.

## Couche 2 — Sources souhaitées

Liste en langage naturel les sources que tu veux que l'agent consulte, groupées par tier :

- Tier A (OAuth / API) : Gmail, Notion, Slack, ...
- Tier B (RSS / public) : arXiv cs.AI, Hacker News, Stratechery (public), ...
- Tier C (sessions browser) : Instagram, LinkedIn, X, Le Monde, ...
- Tier D (institutionnel) : Elsevier ScienceDirect via Saint-Luc, ...

## Couche 3 — Articles-ancres

5-10 URLs d'articles qui représentent ton niveau et ton goût. L'agent les lira pour
calibrer le style et la profondeur attendue.

- https://example.com/article-1
- https://example.com/article-2
$brief$,
'[]'::jsonb,
true
);
