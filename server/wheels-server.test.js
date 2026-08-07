// @vitest-environment node
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import { PassThrough } from 'stream';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';

const require = createRequire(import.meta.url);
const { createWheelsServer } = require('./wheels-server');

let tempDir;
let server;

async function startApi(options = {}) {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'wheels-api-'));
  const dataFile = path.join(tempDir, 'wheels.json');
  server = createWheelsServer({
    dataFile,
    adminPassword: options.adminPassword ?? 'secret',
  });
}

async function requestJson(pathname, options = {}) {
  const request = new PassThrough();
  const body = options.body ? JSON.stringify(options.body) : '';

  request.method = options.method || 'GET';
  request.url = pathname;
  request.headers = {
    host: 'localhost',
    ...(body ? { 'content-type': 'application/json' } : {}),
    ...(options.password ? { 'x-wheels-admin-password': options.password } : {}),
    ...options.headers,
  };

  return new Promise((resolve) => {
    const response = {
      statusCode: 200,
      headers: {},
      writeHead(statusCode, headers) {
        this.statusCode = statusCode;
        this.headers = headers;
      },
      end(payload) {
        resolve({
          response: {
            status: this.statusCode,
            headers: this.headers,
            ok: this.statusCode >= 200 && this.statusCode < 300,
          },
          payload: payload ? JSON.parse(payload) : null,
        });
      },
    };

    server.emit('request', request, response);
    request.end(body);
  });
}

beforeEach(async () => {
  await startApi();
});

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }

  server = null;
  tempDir = null;
});

test('returns default empty shared wheels', async () => {
  const { response, payload } = await requestJson('/api/wheels');

  expect(response.status).toBe(200);
  expect(payload.wheels.map((wheel) => wheel.id)).toEqual(['brunch', 'dinner', 'boba']);
  expect(payload.wheels.every((wheel) => wheel.items.length === 0)).toBe(true);
});

test('supports item CRUD without leaking between wheels', async () => {
  const created = await requestJson('/api/wheels/brunch/items', {
    method: 'POST',
    password: 'secret',
    body: { label: 'Republique' },
  });

  expect(created.response.status).toBe(201);
  expect(created.payload.wheel.items).toHaveLength(1);

  const itemId = created.payload.item.id;
  const dinner = await requestJson('/api/wheels/dinner');
  expect(dinner.payload.wheel.items).toHaveLength(0);

  const updated = await requestJson(`/api/wheels/brunch/items/${itemId}`, {
    method: 'PATCH',
    password: 'secret',
    body: { label: 'Marugame' },
  });
  expect(updated.response.status).toBe(200);
  expect(updated.payload.item.label).toBe('Marugame');

  const deleted = await requestJson(`/api/wheels/brunch/items/${itemId}`, {
    method: 'DELETE',
    password: 'secret',
  });
  expect(deleted.response.status).toBe(200);
  expect(deleted.payload.wheel.items).toHaveLength(0);
});

test('rejects mutating requests with missing or wrong password', async () => {
  const missing = await requestJson('/api/wheels/brunch/items', {
    method: 'POST',
    body: { label: 'No Password Cafe' },
  });
  expect(missing.response.status).toBe(401);

  const wrong = await requestJson('/api/wheels/brunch/items', {
    method: 'POST',
    password: 'wrong',
    body: { label: 'Wrong Password Cafe' },
  });
  expect(wrong.response.status).toBe(401);
});

test('rejects invalid wheel ids and invalid labels', async () => {
  const invalidWheel = await requestJson('/api/wheels/lunch');
  expect(invalidWheel.response.status).toBe(404);

  const blank = await requestJson('/api/wheels/brunch/items', {
    method: 'POST',
    password: 'secret',
    body: { label: '   ' },
  });
  expect(blank.response.status).toBe(400);

  const tooLong = await requestJson('/api/wheels/brunch/items', {
    method: 'POST',
    password: 'secret',
    body: { label: 'x'.repeat(81) },
  });
  expect(tooLong.response.status).toBe(400);

  const first = await requestJson('/api/wheels/brunch/items', {
    method: 'POST',
    password: 'secret',
    body: { label: 'Sun Nong Dan' },
  });
  expect(first.response.status).toBe(201);

  const duplicate = await requestJson('/api/wheels/brunch/items', {
    method: 'POST',
    password: 'secret',
    body: { label: 'Sun Nong Dan' },
  });
  expect(duplicate.response.status).toBe(400);
});
