# Job Triage Browser Extension

A local-first, privacy-focused browser extension that helps solo developers quickly triage and rank job listings on career pages.

## Features

- **Privacy First**: All data (resume, scores, preferences) stays on device
- **Local Processing**: No cloud services, no telemetry
- **Smart Scoring**: Keyword matching and semantic similarity (coming soon)
- **Fast Triage**: Process 30-50 job listings in under 5 minutes

## Development Setup

### Prerequisites

- Node.js 18+ and pnpm
- Chrome, Edge, or other Chromium-based browser

### Installation

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd job-triage
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the extension:
   ```bash
   pnpm build
   ```

   Or run in development mode with auto-rebuild:
   ```bash
   pnpm dev
   ```

### Loading the Extension

1. Open Chrome/Edge and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `dist` folder from this project

### Development Scripts

- `pnpm dev` - Build in watch mode (auto-rebuild on file changes)
- `pnpm build` - Production build
- `pnpm type-check` - Run TypeScript type checking

## Project Structure

```
job-triage/
├── src/
│   ├── content/         # Content script (overlay UI)
│   │   └── index.ts
│   ├── background/      # Service worker (fetching, scoring)
│   │   └── index.ts
│   ├── options/         # Settings page
│   │   ├── index.html
│   │   └── index.ts
│   └── shared/          # Shared utilities and types
│       ├── types.ts
│       ├── constants.ts
│       └── storage.ts
├── public/
│   ├── manifest.json    # Extension manifest
│   └── icons/           # Extension icons
└── dist/                # Build output (generated)
```

## Architecture

- **Content Script**: Injects overlay UI into career pages
- **Background Worker**: Handles network requests, scoring, and caching
- **Options Page**: User settings (resume, preferences, scoring weights)
- **IndexedDB Storage**: Persistent storage for jobs, decisions, and embeddings

## Development Phases

See `docs/product_spec.md` for detailed feature roadmap:

1. **Phase 1 (MVP)**: Basic overlay, keyword scoring, decisions
2. **Phase 1.5**: Multi-site support, keyboard shortcuts
3. **Phase 2**: Local embeddings, semantic similarity
4. **Phase 3**: Multi-ATS presets, profiles, metrics
5. **Phase 4**: Pitch generation, compact UI, polish

## Issue Tracking with bd

This project uses `bd` for issue tracking:

```bash
bd ready                 # Show unblocked work
bd list --status open    # View all open issues
bd show job-triage-1     # View specific issue details
```

## Contributing

This is a solo developer project. Contributions are not currently being accepted.

## License

MIT
