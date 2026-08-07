# Personal Website

This project is a React + Vite static site.

## Development

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Wheels API Workflow

The Wheels page uses a small Node API so every visitor sees the same shared brunch, dinner, and boba wheels.

For local development, run the API and the Vite site in two terminals:

```bash
# terminal 1
WHEELS_ADMIN_PASSWORD=your-edit-password npm run dev:api

# terminal 2
npm run dev
```

Vite proxies `/api` to `http://localhost:8787`. The API stores local data in `server/data/wheels.json`, which is ignored by git. If `WHEELS_ADMIN_PASSWORD` is not set, public reads still work but add/edit/delete requests are rejected.

Production should run the API as a long-lived Node process:

```bash
PORT=8787 \
WHEELS_ADMIN_PASSWORD=your-production-edit-password \
WHEELS_DATA_FILE=/var/lib/personal-website/wheels.json \
npm run start:api
```

Example Nginx routing:

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:8787/api/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

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
- write the gallery manifest to `public/photos/generated/photos.json`

Notes:

- `photos/originals/` is gitignored so you can keep original files local.
- `public/photos/generated/` and `photos.json` should stay out of git; they are deployment artifacts.
- If `photos/originals/` is missing or empty, the generator keeps any existing generated gallery output instead of clearing it.
- On macOS, `sips` is used to create resized JPEG variants. On other systems, the script falls back to copying the original files when image transformation tools are unavailable.

## Deployment

For photography-enabled deployments, build locally and upload `build/` to the server. Do not commit generated photo assets to git history.

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
