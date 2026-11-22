# Social-Media-Grafiken (X / @wutzebaer1, Stake Pool TOOLS)

| Datei | Zweck | Größe |
|---|---|---|
| `x-profile.png` | X-Profilbild (Logo auf dunklem Grund) | 800×800 |
| `x-banner.png` | X-Titelbild | 1500×500 |
| `post-2026-11-rebrand.png` | Post: „CHIEN is now Cardano Tools [TOOLS]“ | 1600×900 |
| `post-2026-11-server.png` | Post: „Rebuilt from scratch.“ | 1600×900 |
| `cardano-tools-pool.png`, `cardano-tools-pool_icon.png` | Pool-Logo für die On-Chain-Metadaten (1024 px / 64 px) | |

Alles basiert auf `public/images/cardano-tools-logo.svg`. Farben `#22d3ee`, `#4d7cfe`, `#a78bfa`
auf einem Verlauf `#070b1d` → `#151a4a` → `#2a1458`, Schrift Inter.

## Neu rendern

Die SVGs in `sources/` enthalten das Logo eingebettet (PNG als Base64), damit sie ohne externe Dateien rendern:

```bash
docker run --rm -v "$PWD/media/social:/w" alpine:3.22 sh -c 'apk add -q --no-cache rsvg-convert font-inter fontconfig >/dev/null && fc-cache -f >/dev/null && cd /w && rsvg-convert -w 1500 sources/x-banner.svg -o x-banner.png && for f in post-2026-11-rebrand post-2026-11-server; do rsvg-convert -w 1600 sources/$f.svg -o $f.png; done'
```
