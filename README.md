# Personal Website

This project is a React + Vite static site.

## Development

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Photography Workflow

The site can generate a local photography gallery with EXIF metadata at build time.

1. Put source images in `photos/originals/`.
2. Run:

```bash
npm run generate:photos
```

The generator will:

- extract available EXIF metadata from JPEG/TIFF source files (best effort)
- create display assets in `public/photos/generated/`
- write the front-end data file to `src/data/photos.generated.json`

Notes:

- `photos/originals/` is gitignored so you can keep original files local.
- If `photos/originals/` is missing, the generator keeps the last committed gallery output instead of clearing it.
- On macOS, `sips` is used to create resized JPEG variants. On other systems, the script falls back to copying the original files when image transformation tools are unavailable.

## Build and Preview

```bash
# Build production assets into ./build and write build/version.json
npm run build

# Preview production build locally
npm run preview
```

## Testing

```bash
# Run once
npm test

# Watch mode
npm run test:watch
```

## Observability (Ops Monitoring)

This repo includes baseline production observability for a static site:

1. Build fingerprint:
- `npm run build` writes `build/version.json` with commit + UTC build time.

2. Health check script:
- `npm run healthcheck` checks:
- home page returns `200`, HTML content, and optional title match
- `/version.json` exists and has required fields

3. Scheduled uptime monitor:
- GitHub Actions workflow: `.github/workflows/uptime-monitor.yml`
- Runs every 15 minutes + manual trigger
- Opens an incident issue on failure, closes it automatically on recovery
- Uses failure backoff: after repeated failures it skips some runs (15m -> 30m -> 1h -> 2h -> 4h -> 8h), then returns to normal after recovery

### Required GitHub Secrets

Set these in your GitHub repo `Settings > Secrets and variables > Actions`:

- `SITE_URL`: your production URL, e.g. `https://yourdomain.com`
- `EXPECTED_TITLE` (optional): exact `<title>` content to verify

### Health Check Examples

```bash
# check production site manually
SITE_URL=https://yourdomain.com npm run healthcheck

# stricter check with expected title
SITE_URL=https://yourdomain.com EXPECTED_TITLE="Eric Song | Personal Website" npm run healthcheck
```

## Deployment (Manual Server Build)

```bash
git pull origin main
npm ci
npm run build
```

Then sync `build/` to your Nginx site root and reload Nginx.

Verify deployment version:

```bash
curl https://yourdomain.com/version.json
```
