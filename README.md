# plint.com

Rebuild of [old-plint.hemsida.eu](https://old-plint.hemsida.eu/) (WordPress + Avada) as a clean Astro site.

## Status

**Phase 1 — bootstrap.** Skeleton pages render, deploy pipeline pushes to a Hetzner preview at `http://204.168.252.110:8081/` (basic auth).

Next phases are tracked in the plan file at `~/.claude/plans/we-will-replicate-https-old-plint-hemsida-sprightly-torvalds.md`.

## Stack

- Astro 6 (static output, `directory` format, trailing slash always)
- `@astrojs/sitemap`
- TypeScript strict
- Vanilla CSS with design tokens (Adobe Typekit fonts pending)
- Node 22 LTS

## Local dev

```bash
nvm use 22
npm install
npm run dev    # http://localhost:4321
npm run build  # → dist/
```

## Deploy

Push to `main` → GitHub Actions builds and rsyncs `dist/` to `/var/www/plint/` on the shared Hetzner box. Caddy serves it on `:8081`. See [`deploy/README.md`](deploy/README.md).

## Project layout

```
src/
├── components/   Header, Footer (more landing later)
├── layouts/      Base.astro
├── pages/        index, solutions, about, contact, news/index
└── styles/       global.css (design tokens)

deploy/
├── caddy/        Caddyfile snippet for :8081 with basic auth
└── README.md     One-time server setup steps
```
