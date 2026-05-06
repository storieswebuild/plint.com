# Plint preview deployment

The plint.com Astro site is built into a static `dist/` directory and served by
**Caddy** on the shared Stories We Build Hetzner box (`204.168.252.110`) at
`http://204.168.252.110:8081/` with HTTP basic auth.

## One-time server setup

These steps were run by hand the first time the preview was wired up. They are
safe to re-run if anything breaks.

```bash
ssh -i ~/.ssh/id_ed25519_storieswebuild root@204.168.252.110

# 1. Site root
mkdir -p /var/www/plint
chown -R caddy:caddy /var/www/plint

# 2. Generate a bcrypt hash for the basic-auth password
caddy hash-password
# (paste the chosen password twice; copy the resulting $2a$... hash)

# 3. Drop the snippet from deploy/caddy/plint-preview.snippet into /etc/caddy/Caddyfile
#    Replace <BCRYPT_HASH> with the hash from step 2.
nano /etc/caddy/Caddyfile

# 4. Validate and reload
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy

# 5. Open the firewall (Hetzner Cloud firewall and / or ufw if active)
ufw allow 8081/tcp || true
# In Hetzner Cloud console: add inbound TCP rule for port 8081 to the server's firewall.
```

## How a deploy works

GitHub Actions (`.github/workflows/deploy.yml`) on push to `main`:

1. Checks out the repo, installs deps with `npm ci`.
2. `npm run build` → produces `dist/`.
3. `rsync -avz --delete` the `dist/` tree to `/var/www/plint/` on the server, using
   the deploy SSH key stored as a repository secret.

Required GitHub repo secrets:

| Secret | Value |
|---|---|
| `HETZNER_HOST` | `204.168.252.110` |
| `HETZNER_USER` | `root` |
| `HETZNER_SSH_KEY` | The private half of the `id_ed25519_storieswebuild` deploy key |

## Manual deploy from a developer machine

```bash
npm run build
rsync -avz --delete -e "ssh -i ~/.ssh/id_ed25519_storieswebuild" \
  dist/ root@204.168.252.110:/var/www/plint/
```

## Sharing the preview

URL: `http://204.168.252.110:8081/`
Username: `plint`
Password: (set during one-time setup; share via 1Password or similar)
