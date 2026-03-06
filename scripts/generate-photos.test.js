/* @vitest-environment node */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { afterEach, expect, test } from 'vitest';

const tempDirs = [];
const require = createRequire(import.meta.url);
const { formatCameraName, formatCapturedAt } = require('./generate-photos.js');

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

test('generates gallery JSON and display assets from source photos', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-generator-'));
  tempDirs.push(tempRoot);

  const sourceDir = path.join(tempRoot, 'originals');
  const outputDir = path.join(tempRoot, 'public', 'photos', 'generated');
  const dataFile = path.join(tempRoot, 'public', 'photos', 'generated', 'photos.json');

  fs.mkdirSync(sourceDir, { recursive: true });
  fs.copyFileSync(
    path.resolve(process.cwd(), 'public', 'images', 'headshot.jpg'),
    path.join(sourceDir, 'test-frame.jpg')
  );

  execFileSync('node', [path.resolve(process.cwd(), 'scripts', 'generate-photos.js')], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PHOTO_SOURCE_DIR: sourceDir,
      PHOTO_OUTPUT_DIR: outputDir,
      PHOTO_DATA_FILE: dataFile,
    },
    stdio: 'ignore',
  });

  const generated = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

  expect(Array.isArray(generated)).toBe(true);
  expect(generated).toHaveLength(1);
  expect(generated[0].slug).toBe('test-frame');
  expect(generated[0].width).toBeGreaterThan(0);
  expect(generated[0].height).toBeGreaterThan(0);
  expect(generated[0].exif.dimensions).toMatch(/\d+\s×\s\d+/);
  expect(fs.existsSync(path.join(outputDir, 'thumbs'))).toBe(true);
  expect(fs.existsSync(path.join(outputDir, 'full'))).toBe(true);
});

test('falls back to the source file creation time when exif capture date is missing', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-generator-'));
  tempDirs.push(tempRoot);

  const sourceDir = path.join(tempRoot, 'originals');
  const outputDir = path.join(tempRoot, 'public', 'photos', 'generated');
  const dataFile = path.join(tempRoot, 'public', 'photos', 'generated', 'photos.json');
  const sourceFile = path.join(sourceDir, 'no-exif.png');

  fs.mkdirSync(sourceDir, { recursive: true });
  fs.copyFileSync(path.resolve(process.cwd(), 'public', 'images', 'icon_email.png'), sourceFile);

  execFileSync('node', [path.resolve(process.cwd(), 'scripts', 'generate-photos.js')], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PHOTO_SOURCE_DIR: sourceDir,
      PHOTO_OUTPUT_DIR: outputDir,
      PHOTO_DATA_FILE: dataFile,
    },
    stdio: 'ignore',
  });

  const generated = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const sourceStat = fs.statSync(sourceFile);
  const expectedCapturedAt = formatCapturedAt(
    Number.isFinite(sourceStat.birthtimeMs) && sourceStat.birthtimeMs > 0
      ? sourceStat.birthtimeMs
      : sourceStat.mtimeMs
  );

  expect(generated).toHaveLength(1);
  expect(generated[0].exif.capturedAt).toBe(expectedCapturedAt);
});

test('normalizes camera model names into readable labels', () => {
  expect(formatCameraName('NIKON CORPORATION', 'NIKON Z 7_2')).toBe('Nikon Z7II');
  expect(formatCameraName('DJI', 'FC3582')).toBe('DJI Mini 3 Pro');
});

test('keeps an existing generated gallery when the source directory is empty', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-generator-'));
  tempDirs.push(tempRoot);

  const sourceDir = path.join(tempRoot, 'originals');
  const outputDir = path.join(tempRoot, 'public', 'photos', 'generated');
  const dataFile = path.join(tempRoot, 'public', 'photos', 'generated', 'photos.json');

  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(path.join(outputDir, 'thumbs'), { recursive: true });
  fs.mkdirSync(path.join(outputDir, 'full'), { recursive: true });
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(
    dataFile,
    JSON.stringify([{ id: 'existing-photo', thumbSrc: '/photos/generated/thumbs/existing.jpg' }], null, 2)
  );
  fs.writeFileSync(path.join(outputDir, 'thumbs', 'existing.jpg'), 'thumb');
  fs.writeFileSync(path.join(outputDir, 'full', 'existing.jpg'), 'full');

  execFileSync('node', [path.resolve(process.cwd(), 'scripts', 'generate-photos.js')], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PHOTO_SOURCE_DIR: sourceDir,
      PHOTO_OUTPUT_DIR: outputDir,
      PHOTO_DATA_FILE: dataFile,
    },
    stdio: 'ignore',
  });

  const generated = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

  expect(generated).toHaveLength(1);
  expect(generated[0].id).toBe('existing-photo');
  expect(fs.existsSync(path.join(outputDir, 'thumbs', 'existing.jpg'))).toBe(true);
  expect(fs.existsSync(path.join(outputDir, 'full', 'existing.jpg'))).toBe(true);
});

test('skips regeneration when source files have not changed', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-generator-'));
  tempDirs.push(tempRoot);

  const sourceDir = path.join(tempRoot, 'originals');
  const outputDir = path.join(tempRoot, 'public', 'photos', 'generated');
  const dataFile = path.join(outputDir, 'photos.json');

  fs.mkdirSync(sourceDir, { recursive: true });
  fs.copyFileSync(
    path.resolve(process.cwd(), 'public', 'images', 'headshot.jpg'),
    path.join(sourceDir, 'test-frame.jpg')
  );

  const runGenerator = () =>
    execFileSync('node', [path.resolve(process.cwd(), 'scripts', 'generate-photos.js')], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PHOTO_SOURCE_DIR: sourceDir,
        PHOTO_OUTPUT_DIR: outputDir,
        PHOTO_DATA_FILE: dataFile,
      },
      encoding: 'utf8',
    });

  runGenerator();

  const thumbPath = path.join(outputDir, 'thumbs', 'test-frame.jpg');
  const fullPath = path.join(outputDir, 'full', 'test-frame.jpg');
  const cachePath = path.join(outputDir, '.cache.json');
  const initialThumbMtime = fs.statSync(thumbPath).mtimeMs;
  const initialFullMtime = fs.statSync(fullPath).mtimeMs;
  const initialDataMtime = fs.statSync(dataFile).mtimeMs;
  const initialCacheMtime = fs.statSync(cachePath).mtimeMs;

  const secondRunOutput = runGenerator();

  expect(secondRunOutput).toMatch(/No photo changes detected/i);
  expect(fs.statSync(thumbPath).mtimeMs).toBe(initialThumbMtime);
  expect(fs.statSync(fullPath).mtimeMs).toBe(initialFullMtime);
  expect(fs.statSync(dataFile).mtimeMs).toBe(initialDataMtime);
  expect(fs.statSync(cachePath).mtimeMs).toBe(initialCacheMtime);
});

test('removes stale generated assets when a source photo is deleted', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-generator-'));
  tempDirs.push(tempRoot);

  const sourceDir = path.join(tempRoot, 'originals');
  const outputDir = path.join(tempRoot, 'public', 'photos', 'generated');
  const dataFile = path.join(outputDir, 'photos.json');

  fs.mkdirSync(sourceDir, { recursive: true });
  fs.copyFileSync(
    path.resolve(process.cwd(), 'public', 'images', 'headshot.jpg'),
    path.join(sourceDir, 'first-frame.jpg')
  );
  fs.copyFileSync(
    path.resolve(process.cwd(), 'public', 'images', 'headshot.jpg'),
    path.join(sourceDir, 'second-frame.jpg')
  );

  const runGenerator = () =>
    execFileSync('node', [path.resolve(process.cwd(), 'scripts', 'generate-photos.js')], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PHOTO_SOURCE_DIR: sourceDir,
        PHOTO_OUTPUT_DIR: outputDir,
        PHOTO_DATA_FILE: dataFile,
      },
      encoding: 'utf8',
    });

  runGenerator();

  fs.rmSync(path.join(sourceDir, 'second-frame.jpg'));
  const secondRunOutput = runGenerator();
  const generated = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

  expect(secondRunOutput).toMatch(/stale assets removed/i);
  expect(generated).toHaveLength(1);
  expect(generated[0].slug).toBe('first-frame');
  expect(fs.existsSync(path.join(outputDir, 'thumbs', 'second-frame.jpg'))).toBe(false);
  expect(fs.existsSync(path.join(outputDir, 'full', 'second-frame.jpg'))).toBe(false);
});
