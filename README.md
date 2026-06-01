# PickleBallers PWA

PickleBallers is a mobile-first pickleball product workspace. It includes a React PWA implementation, a static clickable mockup, product documentation, and comparative research from related sports/community apps.

> The repository folder is still named `pickleplay/` for legacy reasons; the product brand is **PickleBallers**.

> 🗺️ **New here?** Skim [FILEMAP.md](FILEMAP.md) first — it's the repo map (what lives where, plus each area's own file-map). Repo-wide agent conventions live in [AGENTS.md](AGENTS.md).

## What Is In This Repo

- `app/` contains the React + TypeScript + Vite PWA prototype.
- `mockup/` contains the production-style static multi-page HTML mockup.
- `docs/` contains the PickleBallers product, navigation, data, design, and UX documentation.
- `pickleheads/`, `PlayByPoint/`, `Playtomic/`, and `ReClub/` contain source screenshots and reverse-engineered app research docs.
- `docs/COMPARATIVE-ANALYSIS.md` summarizes competitive product insights.
- `docs/README-APPS.md` indexes the app research documentation sets.

## Run The React PWA

```powershell
cd app
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

Useful app commands:

```powershell
npm run build
npm run lint
npm run preview
```

## Run The Static Mockup

From the repo root:

```powershell
.\app\node_modules\.bin\vite.cmd mockup --host 127.0.0.1 --port 4177
```

Then open:

```text
http://127.0.0.1:4177/
```

The mockup uses real page URLs instead of a single iframe/blob shell. The entry page redirects to `mockup/login_pickleplay_playful/code.html`, and shared navigation is handled by `mockup/app-router.js`.

## Documentation

Core PickleBallers docs:

- [Product Spec](docs/PRODUCT-SPEC.md)
- [Sitemap](docs/SITEMAP.md)
- [Navigation](docs/NAVIGATION.md)
- [Feature Matrix](docs/FEATURE-MATRIX.md)
- [Data Model](docs/DATA-MODEL.md)
- [Design Tokens](docs/DESIGN-TOKENS.md)
- [UX Patterns](docs/UX-PATTERNS.md)
- [Component Inventory](docs/COMPONENT-INVENTORY.md)
- [Borrowed Features](docs/BORROWED-FEATURES.md)

Mockup design doc:

- [PickleBallers Static Mockup Design](mockup/pickleball_social_play/DESIGN.md)

Research documentation:

- [Multi-App Documentation Index](docs/README-APPS.md)
- [Pickleheads Docs](pickleheads/README-DOCS.md)
- [PlayByPoint Docs](PlayByPoint/md/README-DOCS.md)
- [Playtomic Docs](Playtomic/md/README-DOCS.md)
- [ReClub Docs](ReClub/md/README-DOCS.md)

## Current Status

The repo currently contains both the richer React PWA prototype and the static HTML mockup. The mockup has been adjusted for a production-style presentation, smaller mobile-friendly typography, 16px `rounded-lg`, 16px max pill radius, and real multi-page URLs.

## Notes

This repository intentionally includes research screenshots and generated documentation because they are part of the product discovery and design reference set. Generated dependencies and build outputs are ignored via `.gitignore`.
