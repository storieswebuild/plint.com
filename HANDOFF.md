# plint.com — Session Handoff

Last updated 2026-05-06. Hand this to the next chat so it can pick up the rebuild without rediscovering the codebase.

---

## 1. What this project is

A clean Astro rebuild of [old-plint.hemsida.eu](https://old-plint.hemsida.eu/) (WordPress 6.9.4 + Avada theme), hosted on the shared Stories We Build Hetzner box. The aim is a pixel-faithful rebuild that drops the WordPress baggage and gives Plint a small, fast, maintainable codebase.

- **Old:** `old-plint.hemsida.eu` on WordPress + Avada (managed by mk-design.se)
- **New:** `plint.com` (eventually) — Astro 6 + content collections, deployed to Hetzner
- **Preview:** http://204.168.252.110:8081/ — basic auth `plint` / `Iqa0gepT5vlCrMB9fHmY`
- **Repo:** [storieswebuild/plint.com](https://github.com/storieswebuild/plint.com), branch `main`, auto-deploys on push
- **Plan file:** `~/.claude/plans/we-will-replicate-https-old-plint-hemsida-sprightly-torvalds.md`

---

## 2. Stack

| Piece | What |
|---|---|
| Frontend | **Astro 6.1.5**, content collections (`src/content/news/*.md`) using the new `glob` loader |
| Styling | Vanilla CSS with design tokens in `src/styles/global.css` (no Tailwind) |
| Fonts | **Adobe Fonts kit `hkg8oak`** — Neue Haas Grotesk Display Pro + Text Pro. Loaded via `<link rel="stylesheet" href="https://use.typekit.net/hkg8oak.css">` in `Base.astro` |
| Hosting | Multi-tenant Hetzner box `204.168.252.110`. SSH key `~/.ssh/id_ed25519_storieswebuild`. Also serves storieswebuild.se, vetgig.com, broakullaloppet.se, hola.thewoodenbox.mx |
| Web server | **Caddy 2.6.2** at `/etc/caddy/Caddyfile`. Plint preview is a `:8081` block with `basicauth` (note: Caddy 2.6 uses `basicauth`, not `basic_auth`) |
| Deploy | `.github/workflows/deploy.yml` — push to `main` → npm ci → npm run build → rsync `dist/` → `/var/www/plint/` then `chown caddy:caddy`. Uses `easingthemes/ssh-deploy@main` (NOT `@v5` — that tag doesn't exist) |
| Node | Node 22 (matching the Hetzner box). Local: `nvm use 22` before any work |

---

## 3. Live URLs

- **Preview:** http://204.168.252.110:8081/ (basic auth — see top)
- **Repo:** https://github.com/storieswebuild/plint.com
- **Actions / CI:** https://github.com/storieswebuild/plint.com/actions
- **Live source site (the one we're replicating):** https://old-plint.hemsida.eu/
- **Adobe Fonts kit:** https://use.typekit.net/hkg8oak.css (project name `plint-com`, ID `hkg8oak`)

---

## 4. What got done in this session

Chronological commit log (last → first):

```
cc96281 Phase 2: real content — Typekit fonts + 9 news posts + page rebuilds
d569f7b ci: use easingthemes/ssh-deploy@main + ssh-keyscan + post-deploy chown
cf2b69e ci: smoke-test the Hetzner deploy workflow
425acbc Add asset scraper + wire Plint logo into header
9f60fed Bootstrap Astro project + Hetzner preview pipeline
```

### Big themes
- **Bootstrap.** Empty repo `storieswebuild/plint.com` cloned, Astro 6 scaffolded with `@astrojs/sitemap`. Skeleton pages: home, solutions, about, news, contact.
- **Hetzner preview wired.** `/var/www/plint/` provisioned, Caddy block on `:8081` with bcrypt-hashed basic auth (creds above). Caddyfile backed up to `/etc/caddy/Caddyfile.bak.pre-plint-<timestamp>` before edit.
- **CI fix.** First two pushes failed because `easingthemes/ssh-deploy@v5` is not a published tag. Switched to `@main` and added an explicit `ssh-keyscan` step + `appleboy/ssh-action` post-deploy chown. Matches the vetgig.com workflow pattern that's known to work on this box.
- **Asset scrape.** `scripts/scrape-assets.mjs` crawls every URL in the sitemaps, parses HTML/CSS for image+font URLs, and downloads everything from `wp-content/uploads/*` into `./.scraped/` (gitignored, outside `public/`). First run pulled **359 assets / 18.4 MB / 0 errors**.
- **Logo wiring.** Plint wordmark SVG in `public/logo/Plint.svg`. Inlined as `src/components/Logo.astro` using `fill="currentColor"` so it adapts to dark/light contexts. Header tone is controlled per-page via `headerTone` prop on `Base.astro` → `[data-header-tone]` attribute on `<body>`.
- **News migration.** `scripts/migrate-news.mjs` fetches the 9 live news URLs, extracts og:title/og:image/og:description/article:published_time/article:tag, converts the `<article>` body to Markdown via a tiny in-house HTML→MD converter, and emits `src/content/news/<slug>.md`. Hero images are copied from the scrape into `public/images/news/<slug>.{png,jpg}`. **Avada cruft is stripped** (post-header dup, "Your Content Goes Here", `[Press](.../category/...)` meta lines, related-posts carousel, sharing-box, orphan tag fragments).
- **Adobe Fonts kit `hkg8oak`** created via the browser — Neue Haas Grotesk Display Pro + Text Pro, 8 fonts. Note: defaults included Light 45 (not Roman 55) for Display; live site uses 55 Roman. Visually close enough for now; if typography looks off, edit the project on adobe.com to swap weights.
- **Phase 2 content rebuild.**
  - Homepage: full-bleed orange-sphere hero + walking figure + "Localisation evolved" eyebrow + "Pioneering the next era of localisation" headline. Then dark intro section, **`<ClientLogos />` band** (6 entertainment-industry logos auto-scrolling), **Gothenburg news-feature** with cityscape bg + latest press release, **career CTA section** ("Are you an experienced linguist..."). All matching the live site's section sequence.
  - News listing: 3-column grid of cards with category, date, title, excerpt, hero. Sorted by date desc.
  - News detail (`[slug].astro`): title + meta + hero + Markdown body + back link. Uses Astro v6 `render(post)` + `entry.data.slug` (NOT `entry.slug` — that's v5).
  - About / Solutions / Contact: real copy + dark heroes + scraped imagery. Solutions has 4 service cards (subtitling, dubbing, access services, technology). Contact lists 4 department emails + a placeholder form.
  - Footer (David edited): Headquarters address (Kaserntorget 6, SE-411 18 Göteborg), nav links (News, Career, Privacy Policy, Whistle-blowing Policy, Contact), badges (LinkedIn icon at `public/images/badges/linkedin.svg`, ISO 27001 white, TPN gold).

---

## 5. Where things live

```
src/
  layouts/Base.astro              ← <head>, Typekit link, header tone prop, Header/Footer slot
  components/
    Header.astro                  ← logo + nav, color via [data-header-tone]
    Footer.astro                  ← address + nav + badges (David's design)
    Logo.astro                    ← inline Plint wordmark, fill=currentColor
    ClientLogos.astro             ← infinite-scrolling marquee, 6 entertainment client logos
  pages/
    index.astro                   ← hero + intro + ClientLogos + news-feature + career CTA
    solutions.astro, about.astro, contact.astro
    news/index.astro              ← listing
    news/[slug].astro             ← dynamic detail from collection
  content/news/*.md               ← 9 migrated posts (frontmatter: title, slug, date, category, tags, hero, excerpt)
  content.config.ts               ← Astro v6 collection schema using glob loader
  styles/global.css               ← design tokens (--color-*, --font-display, --font-body)

public/
  logo/Plint.svg                  ← user-provided wordmark
  images/
    news/<slug>.{jpg,png}         ← migrated hero images
    site/                         ← homepage + page hero photos (hero-sphere, news-feature-bg, etc.)
    logos/                        ← ClientLogos: viaplay, paramount, nbcu, wb, netflix, eu (.png)
    badges/                       ← Footer: linkedin.svg, iso-27001.png, tpn.png

scripts/
  scrape-assets.mjs               ← idempotent: crawls sitemaps, downloads to ./.scraped/
  migrate-news.mjs                ← idempotent: fetches 9 news URLs → src/content/news/*.md

deploy/
  caddy/plint-preview.snippet     ← reference Caddyfile snippet
  README.md                       ← server setup steps

.github/workflows/deploy.yml      ← rsync + chown deploy on push to main
.scraped/                         ← gitignored — re-run scrape-assets.mjs to regenerate (18.4 MB)
```

---

## 6. Required GitHub secrets

Already configured (David added 2026-05-06):

| Secret | Value |
|---|---|
| `HETZNER_HOST` | `204.168.252.110` |
| `HETZNER_USER` | `root` |
| `HETZNER_SSH_KEY` | contents of `~/.ssh/id_ed25519_storieswebuild` |

If the workflow fails with "Permission denied (publickey)", re-paste the SSH key — sometimes line endings get mangled.

---

## 7. Useful commands

### Local dev
```bash
nvm use 22
npm install
npm run dev          # http://localhost:4321
npm run build        # → dist/
```

### Re-scrape assets (e.g. after the live site adds new images)
```bash
node scripts/scrape-assets.mjs
# Output goes to ./.scraped/old-plint.hemsida.eu/wp-content/...
# Curated keepers should be copied into public/images/...
```

### Re-migrate news (idempotent — overwrites `src/content/news/*.md`)
```bash
node scripts/migrate-news.mjs
```

### Manual deploy from a developer machine
```bash
npm run build
rsync -rlptDvz --delete -e "ssh -i ~/.ssh/id_ed25519_storieswebuild" \
  dist/ root@204.168.252.110:/var/www/plint/
ssh -i ~/.ssh/id_ed25519_storieswebuild root@204.168.252.110 \
  "chown -R caddy:caddy /var/www/plint"
```

### SSH to the box
```bash
ssh -i ~/.ssh/id_ed25519_storieswebuild root@204.168.252.110
```

### Caddy ops on the server
```bash
# Inspect / edit
nano /etc/caddy/Caddyfile
# Validate before reload (does NOT take effect, just lints)
caddy validate --config /etc/caddy/Caddyfile
# Apply
systemctl reload caddy
# Logs
tail -f /var/log/caddy/plint-preview.log
```

---

## 8. Known issues / open work

### Active rough edges
1. **Logos render with white blocks** in the deployed `ClientLogos` band. The source PNGs are 8-bit grayscale (no alpha), white background + dark glyph. Component already applies `filter: invert(1); opacity: 0.95` which on a `#000` bg should produce white-glyph-on-black → blends in. If it's still wrong on the live preview, try `mix-blend-mode: screen` in addition to invert, or replace the PNGs with proper transparent SVGs from each studio's brand kit.
2. **News article bodies still have leftover whitespace** between paragraphs and a small Avada widget tail on a couple of posts. Migration script has been improved iteratively; one more pass through the regex chain in `scripts/migrate-news.mjs` would clean these up.
3. **Solutions subpages** (`/subtitling/`, `/dubbing/`, `/access-services/`, `/technology/`) are referenced from `src/pages/solutions.astro` but not yet rebuilt as standalone pages. The live site has dedicated pages for each.
4. **About page** has hero + story, but the live site has additional sections below (sustainability commitment, leadership, awards) we haven't rebuilt.
5. **Contact form** is intentionally a placeholder — the `<button>` is disabled with a "coming soon" note. Users get four department emails (`sales@`, `press@`, `production@`, `people@plint.com`) and `mailto:` links instead.

### Decisions deferred
- **News CMS.** Right now news is Markdown in the repo. Editing means a PR. When Plint is ready for non-technical editing, pick from Sanity (hosted, polished editor), Decap CMS (git-based, free, admin at `/admin/`), or a custom Postgres + admin.
- **Cookiebot.** Live site uses Cookiebot (`data-cbid: 431cd2c3-3ede-4389-bb6e-1b569831f90f`). Currently dropped from the Astro rebuild. User said "skip for now."

---

## 9. Gotchas / things that bit us

- **Astro v6 content collections changed.** `src/content/config.ts` → `src/content.config.ts`. Schema uses `glob({ pattern, base })` loader, not the legacy `type: 'content'`. Pages access frontmatter via `entry.data.slug`, not `entry.slug`. Use `render(post)` from `astro:content`, not `await post.render()`.
- **Caddy 2.6 uses `basicauth`, not `basic_auth`.** First Caddyfile push failed validation because of this. Caddy 2.8+ accepts both.
- **`easingthemes/ssh-deploy@v5` is not a real tag.** Use `@main`. Match the vetgig.com workflow pattern.
- **Astro copies all of `public/` to `dist/` verbatim.** The first scrape went into `public/scraped/` and got deployed (18 MB extra). Now the scrape lives at `./.scraped/` (gitignored, outside `public/`). Don't move it back.
- **rsync as root preserves the local UID** (501) on the server. Use `-rlptDvz` (`-a` minus `-o -g`) and a post-deploy `chown -R caddy:caddy /var/www/plint` so Caddy can read everything.
- **Adobe Fonts UI is account-tier dependent.** Without Creative Cloud, the per-font `</>` button is hidden — only the Subscribe-to-Creative-Cloud CTA shows. With CC, "Add to Web Project" appears in the family page header AND there's an "Add font" button on each weight row.
- **Adobe Fonts default weights for Neue Haas Grotesk Display include Light 45 (font-weight 400)**, not Roman 55. Live site uses 55 Roman. Visually similar; swap on adobe.com if needed.
- **Privacy filter blocks JS execution in Chrome MCP** when output looks like cookie/query strings. Use `read_page` and small targeted `javascript_tool` snippets instead.

---

## 10. What "Phase 3" looks like (next big push)

When David is ready:
1. Pick a CMS (see §8 "Decisions deferred"). Wire it up to drive news.
2. Build out Solutions subpages (subtitling, dubbing, access services, technology).
3. Rebuild deeper About sections (commitment, leadership, awards).
4. Real contact form backend (Resend or a small endpoint).
5. Migrate `plint.com` DNS once Plint is happy with the preview.
6. Cookiebot decision (keep, drop, or replace).
