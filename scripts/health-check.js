const { performance } = require('perf_hooks');

const SITE_URL = process.env.SITE_URL;
const EXPECTED_TITLE = process.env.EXPECTED_TITLE || '';
const TIMEOUT_MS = Number(process.env.HEALTHCHECK_TIMEOUT_MS || 8000);
const MAX_RESPONSE_MS = Number(process.env.HEALTHCHECK_MAX_RESPONSE_MS || 3000);

function fail(message) {
  console.error(`[health-check] ${message}`);
  process.exit(1);
}

async function fetchWithTimer(url) {
  const start = performance.now();
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const elapsed = performance.now() - start;
  return { response, elapsed };
}

async function checkHomePage() {
  const rootUrl = SITE_URL.endsWith('/') ? SITE_URL : `${SITE_URL}/`;
  const { response, elapsed } = await fetchWithTimer(rootUrl);
  const html = await response.text();

  if (!response.ok) {
    fail(`Home page returned HTTP ${response.status}`);
  }
  if (elapsed > MAX_RESPONSE_MS) {
    fail(`Home page response time ${elapsed.toFixed(2)}ms exceeded ${MAX_RESPONSE_MS}ms`);
  }
  if (!html.toLowerCase().includes('<html')) {
    fail('Home page did not return HTML');
  }
  if (EXPECTED_TITLE && !html.includes(`<title>${EXPECTED_TITLE}</title>`)) {
    fail(`Title check failed. Expected "<title>${EXPECTED_TITLE}</title>"`);
  }

  console.log(`[health-check] Home page OK: ${response.status} in ${elapsed.toFixed(2)}ms`);
}

async function checkVersionJson() {
  const versionUrl = SITE_URL.endsWith('/')
    ? `${SITE_URL}version.json`
    : `${SITE_URL}/version.json`;

  const { response, elapsed } = await fetchWithTimer(versionUrl);
  const body = await response.text();

  if (!response.ok) {
    fail(`version.json returned HTTP ${response.status}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    fail('version.json is not valid JSON');
  }

  if (!parsed.commit || !parsed.buildTimeUtc) {
    fail('version.json missing required fields: commit/buildTimeUtc');
  }

  console.log(
    `[health-check] version.json OK: commit=${parsed.commit}, buildTimeUtc=${parsed.buildTimeUtc}, ${elapsed.toFixed(2)}ms`
  );
}

async function main() {
  if (!SITE_URL) {
    fail('SITE_URL is required. Example: SITE_URL=https://example.com npm run healthcheck');
  }

  await checkHomePage();
  await checkVersionJson();
  console.log('[health-check] All checks passed');
}

main().catch((error) => fail(error.message || String(error)));
