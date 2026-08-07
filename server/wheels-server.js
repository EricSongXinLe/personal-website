const crypto = require('crypto');
const fs = require('fs/promises');
const http = require('http');
const path = require('path');

const WHEEL_DEFINITIONS = [
  { id: 'brunch', label: 'Brunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'boba', label: 'Boba' },
];

const WHEEL_IDS = new Set(WHEEL_DEFINITIONS.map((wheel) => wheel.id));
const DEFAULT_DATA_FILE = path.join(__dirname, 'data', 'wheels.json');
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_LABEL_LENGTH = 80;

function getDefaultData() {
  return {
    wheels: WHEEL_DEFINITIONS.map((wheel) => ({
      ...wheel,
      items: [],
    })),
  };
}

function normalizeItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const id = typeof item.id === 'string' ? item.id : '';
  const label = typeof item.label === 'string' ? item.label.trim() : '';

  if (!id || !label) {
    return null;
  }

  return {
    id,
    label,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : null,
  };
}

function normalizeData(rawData) {
  const rawWheels = Array.isArray(rawData?.wheels) ? rawData.wheels : [];

  return {
    wheels: WHEEL_DEFINITIONS.map((definition) => {
      const existingWheel = rawWheels.find((wheel) => wheel?.id === definition.id);
      const items = Array.isArray(existingWheel?.items)
        ? existingWheel.items.map(normalizeItem).filter(Boolean)
        : [];

      return {
        ...definition,
        items,
      };
    }),
  };
}

function findWheel(data, wheelId) {
  return data.wheels.find((wheel) => wheel.id === wheelId) || null;
}

function validateWheelId(wheelId) {
  return WHEEL_IDS.has(wheelId);
}

function validateLabel(rawLabel, items, currentItemId = null) {
  const label = typeof rawLabel === 'string' ? rawLabel.trim() : '';

  if (!label) {
    return { error: 'Label is required.' };
  }

  if (label.length > MAX_LABEL_LENGTH) {
    return { error: `Label must be ${MAX_LABEL_LENGTH} characters or fewer.` };
  }

  const duplicate = items.some((item) => item.id !== currentItemId && item.label === label);
  if (duplicate) {
    return { error: 'That item already exists on this wheel.' };
  }

  return { label };
}

async function readData(dataFile) {
  try {
    const body = await fs.readFile(dataFile, 'utf8');
    return normalizeData(JSON.parse(body));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return getDefaultData();
    }

    throw error;
  }
}

async function writeDataAtomic(dataFile, data) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });

  const tempFile = `${dataFile}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(tempFile, dataFile);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;

      if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }));
        request.destroy();
      }
    });
    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(Object.assign(new Error('Request body must be valid JSON.'), { statusCode: 400 }));
      }
    });
    request.on('error', reject);
  });
}

function isPasswordMatch(request, adminPassword) {
  if (!adminPassword) {
    return false;
  }

  const providedPassword = request.headers['x-wheels-admin-password'];
  if (typeof providedPassword !== 'string') {
    return false;
  }

  const provided = Buffer.from(providedPassword);
  const expected = Buffer.from(adminPassword);

  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

function createItem(label) {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    label,
    createdAt: now,
    updatedAt: null,
  };
}

function createWheelsServer(options = {}) {
  const dataFile = options.dataFile || process.env.WHEELS_DATA_FILE || DEFAULT_DATA_FILE;
  const adminPassword =
    options.adminPassword === undefined ? process.env.WHEELS_ADMIN_PASSWORD : options.adminPassword;
  let mutationQueue = Promise.resolve();

  async function runMutation(mutator) {
    const operation = mutationQueue.then(async () => {
      const data = await readData(dataFile);
      const result = await mutator(data);
      await writeDataAtomic(dataFile, data);
      return result;
    });

    mutationQueue = operation.catch(() => undefined);
    return operation;
  }

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const pathParts = url.pathname.split('/').filter(Boolean);

      if (request.method === 'OPTIONS') {
        sendJson(response, 204, {});
        return;
      }

      if (pathParts[0] !== 'api' || pathParts[1] !== 'wheels') {
        sendJson(response, 404, { error: 'Not found.' });
        return;
      }

      if (request.method === 'GET' && pathParts.length === 2) {
        const data = await readData(dataFile);
        sendJson(response, 200, data);
        return;
      }

      const wheelId = pathParts[2];
      if (!validateWheelId(wheelId)) {
        sendJson(response, 404, { error: 'Wheel not found.' });
        return;
      }

      if (request.method === 'GET' && pathParts.length === 3) {
        const data = await readData(dataFile);
        sendJson(response, 200, { wheel: findWheel(data, wheelId) });
        return;
      }

      if (!adminPassword) {
        sendJson(response, 503, { error: 'Wheel editing is not configured.' });
        return;
      }

      if (!isPasswordMatch(request, adminPassword)) {
        sendJson(response, 401, { error: 'Wheel editing password is incorrect.' });
        return;
      }

      if (request.method === 'POST' && pathParts.length === 4 && pathParts[3] === 'items') {
        const body = await readJsonBody(request);
        const result = await runMutation((data) => {
          const wheel = findWheel(data, wheelId);
          const validation = validateLabel(body.label, wheel.items);

          if (validation.error) {
            return { statusCode: 400, payload: { error: validation.error } };
          }

          const item = createItem(validation.label);
          wheel.items.push(item);
          return { statusCode: 201, payload: { wheel, item } };
        });
        sendJson(response, result.statusCode, result.payload);
        return;
      }

      if (
        request.method === 'PATCH' &&
        pathParts.length === 5 &&
        pathParts[3] === 'items' &&
        pathParts[4]
      ) {
        const itemId = pathParts[4];
        const body = await readJsonBody(request);
        const result = await runMutation((data) => {
          const wheel = findWheel(data, wheelId);
          const item = wheel.items.find((entry) => entry.id === itemId);

          if (!item) {
            return { statusCode: 404, payload: { error: 'Item not found.' } };
          }

          const validation = validateLabel(body.label, wheel.items, itemId);
          if (validation.error) {
            return { statusCode: 400, payload: { error: validation.error } };
          }

          item.label = validation.label;
          item.updatedAt = new Date().toISOString();
          return { statusCode: 200, payload: { wheel, item } };
        });
        sendJson(response, result.statusCode, result.payload);
        return;
      }

      if (
        request.method === 'DELETE' &&
        pathParts.length === 5 &&
        pathParts[3] === 'items' &&
        pathParts[4]
      ) {
        const itemId = pathParts[4];
        const result = await runMutation((data) => {
          const wheel = findWheel(data, wheelId);
          const itemIndex = wheel.items.findIndex((entry) => entry.id === itemId);

          if (itemIndex === -1) {
            return { statusCode: 404, payload: { error: 'Item not found.' } };
          }

          const [item] = wheel.items.splice(itemIndex, 1);
          return { statusCode: 200, payload: { wheel, item } };
        });
        sendJson(response, result.statusCode, result.payload);
        return;
      }

      sendJson(response, 404, { error: 'Not found.' });
    } catch (error) {
      sendJson(response, error.statusCode || 500, { error: error.message || 'Server error.' });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8787);
  const server = createWheelsServer();

  server.listen(port, () => {
    console.log(`[wheels] API listening on http://localhost:${port}`);
    console.log(`[wheels] Data file: ${process.env.WHEELS_DATA_FILE || DEFAULT_DATA_FILE}`);

    if (!process.env.WHEELS_ADMIN_PASSWORD) {
      console.warn('[wheels] WHEELS_ADMIN_PASSWORD is not set; mutating requests will be rejected.');
    }
  });
}

module.exports = {
  createWheelsServer,
  getDefaultData,
  normalizeData,
  WHEEL_DEFINITIONS,
};
