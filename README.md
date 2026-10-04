# Sketchboard

A hand-drawn style, infinite whiteboard that runs **entirely in the browser**. Sketch diagrams,
wireframes and ideas, then share a whole board as a single link. There is no backend, so it can be
hosted on any static host such as GitHub Pages.

## Features

**Drawing**

- Rectangle, diamond, ellipse, arrow, line, freehand pen (pressure-aware), text and images
- Hand-drawn rendering with three sloppiness levels; hachure, cross-hatch, zigzag and solid fills
- Stroke color, fill color, width, dashed or dotted strokes, round or sharp edges, opacity
- Arrowheads: arrow, triangle, dot, bar and diamond
- Arrows bind to shapes and follow them when the shapes move
- Multi-point and curved lines, with draggable points and midpoint handles that insert new points
- Text labels inside shapes and on arrows; hand-drawn, normal and code fonts

**Editing**

- Select, box-select, move, resize and rotate, with Shift (keep aspect ratio) and Alt (from center)
- Smart alignment guides, plus a dot grid with snap-to-grid
- Undo and redo, copy, cut and paste (including images and plain text), duplicate, Alt-drag to
  duplicate
- Group and ungroup, lock, layer ordering, align and distribute, flip, copy and paste styles
- Eraser and a laser pointer for presenting
- Context menu, command palette (`Ctrl/⌘ + K`) and a full keyboard shortcut sheet (`?`)

**Boards**

- Unlimited boards saved automatically in IndexedDB, with thumbnails, search, duplicate and delete
- Shareable links: the board is compressed into the URL hash (`#board=…`), with an optional
  view-only mode
- Export to PNG (1× to 4×, transparent or with a background, light or dark) and SVG with embedded
  fonts, or copy the image to the clipboard
- Save and open editable `.sketchboard` files; drag and drop files or images onto the canvas
- Templates: flowchart, mind map, kanban, SWOT, wireframe and a sample board

**Interface**

- Custom MUI theme with light, dark and system modes
- Minimap, zen mode, view-only mode
- Touch support with pinch-to-zoom and a phone layout
- An illustrated tutorial on first launch, which you can skip or reopen later

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script                 | What it does                            |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | Start the Vite dev server               |
| `npm run build`        | Type-check and build to `dist/`         |
| `npm run preview`      | Serve the production build locally      |
| `npm run lint`         | Run ESLint (fails on any warning)       |
| `npm run lint:fix`     | Run ESLint and auto-fix what it can     |
| `npm run format`       | Format everything with Prettier         |
| `npm run format:check` | Check formatting without changing files |
| `npm run typecheck`    | Run the TypeScript compiler only        |

### Format on save

The repo includes `.vscode/settings.json` and recommended extensions (Prettier, ESLint,
EditorConfig). Install the recommended extensions and VS Code will format with Prettier and apply
ESLint fixes every time you save.

## Deploying to GitHub Pages

The app has no repository-specific configuration. The Vite `base` is `'./'`, so every asset URL is
relative and the same build works at `https://<user>.github.io/<any-repo>/` or at a custom domain.

1. Push the project to a GitHub repository.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. The **Deploy to GitHub Pages** workflow lints, builds and publishes the site.
   You can also run it manually from the **Actions** tab.

### CI

- `.github/workflows/ci.yml` runs on every push to any branch and on pull requests. It runs ESLint,
  Prettier's format check, and a type-check plus build.
- `.github/workflows/deploy.yml` runs on pushes to `main`. It lints, builds and deploys to Pages.

## How data is stored

- Boards are kept in your browser's IndexedDB. Small preferences (theme, last-used style) are kept
  in `localStorage`.
- Storage keys include the deployment path. All of a user's GitHub Pages sites share one origin
  (`<user>.github.io`), and this keeps different deployments from overwriting each other's boards.
- Share links hold the board itself, deflate-compressed and base64url-encoded in the URL hash. The
  hash is never sent to a server. Images are left out of links because they are too large; use
  **Save to file** to share boards that contain images.

## Tech

React 19, TypeScript, Vite, MUI (custom theme), Zustand, Rough.js (hand-drawn rendering),
perfect-freehand (pen strokes), fflate (link compression), idb-keyval (IndexedDB) and Lucide icons.
