const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = resolvePath(process.env.PHOTO_SOURCE_DIR, path.join(projectRoot, 'photos', 'originals'));
const outputDir = resolvePath(
  process.env.PHOTO_OUTPUT_DIR,
  path.join(projectRoot, 'public', 'photos', 'generated')
);
const dataFile = resolvePath(process.env.PHOTO_DATA_FILE, path.join(outputDir, 'photos.json'));
const cacheFile = path.join(outputDir, '.cache.json');

const thumbDir = path.join(outputDir, 'thumbs');
const fullDir = path.join(outputDir, 'full');
const supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.heic', '.heif']);
const thumbMaxDimension = Number(process.env.PHOTO_THUMB_MAX || 960);
const fullMaxDimension = Number(process.env.PHOTO_FULL_MAX || 2400);
const shouldClearOnEmpty = process.env.PHOTO_CLEAR_ON_EMPTY === '1';
const generatorVersion = '3';
const generatorConfigSignature = JSON.stringify({
  generatorVersion,
  thumbMaxDimension,
  fullMaxDimension,
});
const cameraModelAliases = new Map([
  ['NIKON Z 7_2', 'Nikon Z7II'],
  ['DJI FC3582', 'DJI Mini 3 Pro'],
]);

function resolvePath(customPath, fallbackPath) {
  if (!customPath) {
    return fallbackPath;
  }

  return path.isAbsolute(customPath) ? customPath : path.resolve(projectRoot, customPath);
}

function main() {
  const files = collectSourceFiles(sourceDir);
  const previousCache = loadCache();

  if (!fs.existsSync(sourceDir)) {
    if (fs.existsSync(dataFile)) {
      console.warn(
        `Photo source directory "${path.relative(projectRoot, sourceDir)}" does not exist; keeping existing generated gallery.`
      );
      return;
    }

    writeDataFile([]);
    console.warn(
      `Photo source directory "${path.relative(projectRoot, sourceDir)}" does not exist; wrote an empty gallery.`
    );
    return;
  }

  if (files.length === 0) {
    if (!shouldClearOnEmpty && hasExistingGeneratedGallery()) {
      console.warn(
        `No supported photo files found in "${path.relative(projectRoot, sourceDir)}"; keeping existing generated gallery.`
      );
      return;
    }

    resetOutputDirectories();
    writeDataFile([]);
    writeCache([]);
    console.log(
      `No supported photo files found in "${path.relative(projectRoot, sourceDir)}"; cleared generated gallery.`
    );
    return;
  }

  ensureOutputDirectories();

  const slugCounts = new Map();
  const previousEntries = new Map(previousCache.entries.map((entry) => [entry.sourceRelativePath, entry]));
  const nextEntries = files.map((filePath, index) => {
    const sourceRelativePath = path.relative(sourceDir, filePath);
    const fileName = path.basename(filePath, path.extname(filePath));
    const slug = uniqueSlug(slugify(fileName), slugCounts);
    const sourceStat = fs.statSync(filePath);
    const sourceMeta = {
      relativePath: sourceRelativePath,
      size: sourceStat.size,
      mtimeMs: Math.trunc(sourceStat.mtimeMs),
      createdAtMs: resolveSourceCreatedAtMs(sourceStat),
    };
    const previousEntry = previousEntries.get(sourceRelativePath);

    if (canReuseEntry(previousEntry, sourceMeta, slug, previousCache.configSignature)) {
      return previousEntry;
    }

    return generatePhotoEntry(filePath, index, slug, sourceMeta);
  });

  const photos = nextEntries.map((entry) => entry.photo).sort(sortPhotos);
  const staleAssetsRemoved = removeStaleGeneratedAssets(nextEntries);
  const generationCount = nextEntries.filter((entry) => !entry.reused).length;
  const hasManifestChanged = hasManifestChangedFromCache(previousCache.entries, nextEntries);

  if (generationCount === 0 && staleAssetsRemoved === 0 && !hasManifestChanged && previousCache.entries.length > 0) {
    console.log(`No photo changes detected; kept ${nextEntries.length} generated entr${nextEntries.length === 1 ? 'y' : 'ies'}.`);
    return;
  }

  writeDataFile(photos);
  writeCache(nextEntries);
  console.log(
    `Updated ${nextEntries.length} photo entr${nextEntries.length === 1 ? 'y' : 'ies'} (${generationCount} regenerated, ${staleAssetsRemoved} stale assets removed).`
  );
}

function collectSourceFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(directory, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function hasExistingGeneratedGallery() {
  if (hasExistingGeneratedData()) {
    return true;
  }

  return hasGeneratedAssets();
}

function hasExistingGeneratedData() {
  if (!fs.existsSync(dataFile)) {
    return false;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    return Array.isArray(parsed) && parsed.length > 0;
  } catch (error) {
    return false;
  }
}

function hasGeneratedAssets() {
  if (!fs.existsSync(outputDir)) {
    return false;
  }

  const stack = [outputDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }

      if (entry.name !== '.gitkeep') {
        return true;
      }
    }
  }

  return false;
}

function resetOutputDirectories() {
  fs.rmSync(outputDir, { recursive: true, force: true });
  ensureOutputDirectories();
}

function ensureOutputDirectories() {
  fs.mkdirSync(thumbDir, { recursive: true });
  fs.mkdirSync(fullDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, '.gitkeep'), '', 'utf8');
}

function generatePhotoEntry(filePath, index, slug, sourceMeta) {
  const buffer = fs.readFileSync(filePath);
  const dimensions = getImageDimensions(filePath, buffer);
  const parsedExif = readExif(buffer);
  const createdAt = formatCapturedAt(parsedExif.dateTimeOriginal || parsedExif.dateTime || sourceMeta.createdAtMs);
  const variants = createDisplayAssets(filePath, slug);
  const altText = buildAltText(slug, index + 1);
  const photo = {
    id: slug,
    slug,
    thumbSrc: variants.thumbSrc,
    fullSrc: variants.fullSrc,
    width: dimensions.width,
    height: dimensions.height,
    alt: altText,
    exif: formatExif(parsedExif, dimensions, sourceMeta.createdAtMs),
    sortDate: createdAt,
    sourceName: path.basename(filePath),
  };

  return createCacheEntry(photo, sourceMeta, false);
}

function uniqueSlug(baseSlug, slugCounts) {
  const nextCount = (slugCounts.get(baseSlug) || 0) + 1;
  slugCounts.set(baseSlug, nextCount);
  return nextCount === 1 ? baseSlug : `${baseSlug}-${nextCount}`;
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'photo';
}

function createDisplayAssets(filePath, slug) {
  const transformerAvailable = hasCommand('sips');

  if (transformerAvailable) {
    try {
      const thumbFileName = `${slug}.jpg`;
      const fullFileName = `${slug}.jpg`;
      const thumbPath = path.join(thumbDir, thumbFileName);
      const fullPath = path.join(fullDir, fullFileName);

      transformWithSips(filePath, thumbPath, thumbMaxDimension);
      transformWithSips(filePath, fullPath, fullMaxDimension);

      return {
        thumbSrc: `/photos/generated/thumbs/${thumbFileName}`,
        fullSrc: `/photos/generated/full/${fullFileName}`,
      };
    } catch (error) {
      console.warn(`Fell back to copying "${path.basename(filePath)}" because image conversion failed.`);
    }
  }

  const extension = path.extname(filePath).toLowerCase();
  const thumbFileName = `${slug}${extension}`;
  const fullFileName = `${slug}${extension}`;
  const thumbPath = path.join(thumbDir, thumbFileName);
  const fullPath = path.join(fullDir, fullFileName);

  fs.copyFileSync(filePath, thumbPath);
  fs.copyFileSync(filePath, fullPath);

  return {
    thumbSrc: `/photos/generated/thumbs/${thumbFileName}`,
    fullSrc: `/photos/generated/full/${fullFileName}`,
  };
}

function transformWithSips(inputPath, outputPath, maxDimension) {
  execFileSync(
    'sips',
    ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', '-Z', String(maxDimension), inputPath, '--out', outputPath],
    { stdio: 'ignore' }
  );
}

function hasCommand(commandName) {
  try {
    execFileSync('which', [commandName], { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

function writeDataFile(photos) {
  const normalizedPhotos = photos.map(({ sortDate, sourceName, ...photo }) => photo);
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(dataFile, `${JSON.stringify(normalizedPhotos, null, 2)}\n`, 'utf8');
}

function writeCache(entries) {
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(
    cacheFile,
    `${JSON.stringify(
      {
        configSignature: generatorConfigSignature,
        entries: entries.map((entry) => ({
          sourceRelativePath: entry.sourceRelativePath,
          sourceSize: entry.sourceSize,
          sourceMtimeMs: entry.sourceMtimeMs,
          slug: entry.slug,
          photo: entry.photo,
        })),
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

function loadCache() {
  if (!fs.existsSync(cacheFile)) {
    return { configSignature: '', entries: [] };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    const entries = Array.isArray(parsed.entries)
      ? parsed.entries
          .filter((entry) => entry && entry.sourceRelativePath && entry.photo)
          .map((entry) => ({
            sourceRelativePath: entry.sourceRelativePath,
            sourceSize: entry.sourceSize,
            sourceMtimeMs: entry.sourceMtimeMs,
            slug: entry.slug,
            photo: entry.photo,
            reused: true,
          }))
      : [];

    return {
      configSignature: parsed.configSignature || '',
      entries,
    };
  } catch (error) {
    return { configSignature: '', entries: [] };
  }
}

function createCacheEntry(photo, sourceMeta, reused) {
  return {
    sourceRelativePath: sourceMeta.relativePath,
    sourceSize: sourceMeta.size,
    sourceMtimeMs: sourceMeta.mtimeMs,
    slug: photo.slug,
    photo,
    reused,
  };
}

function canReuseEntry(previousEntry, sourceMeta, slug, previousConfigSignature) {
  if (!previousEntry) {
    return false;
  }

  if (previousConfigSignature !== generatorConfigSignature) {
    return false;
  }

  if (previousEntry.slug !== slug) {
    return false;
  }

  if (previousEntry.sourceSize !== sourceMeta.size || previousEntry.sourceMtimeMs !== sourceMeta.mtimeMs) {
    return false;
  }

  if (!assetsExistForPhoto(previousEntry.photo)) {
    return false;
  }

  return true;
}

function assetsExistForPhoto(photo) {
  return (
    photo &&
    fs.existsSync(resolveGeneratedAssetPath(photo.thumbSrc)) &&
    fs.existsSync(resolveGeneratedAssetPath(photo.fullSrc))
  );
}

function resolveGeneratedAssetPath(assetSrc) {
  return path.join(outputDir, assetSrc.replace('/photos/generated/', ''));
}

function removeStaleGeneratedAssets(entries) {
  const expectedPaths = new Set(entries.flatMap((entry) => [entry.photo.thumbSrc, entry.photo.fullSrc]).map(resolveGeneratedAssetPath));
  const generatedFiles = listGeneratedAssetFiles();
  let removedCount = 0;

  for (const filePath of generatedFiles) {
    if (!expectedPaths.has(filePath)) {
      fs.rmSync(filePath, { force: true });
      removedCount += 1;
    }
  }

  return removedCount;
}

function listGeneratedAssetFiles() {
  const assetDirs = [thumbDir, fullDir];
  const filePaths = [];

  for (const directory of assetDirs) {
    if (!fs.existsSync(directory)) {
      continue;
    }

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isFile()) {
        filePaths.push(path.join(directory, entry.name));
      }
    }
  }

  return filePaths;
}

function hasManifestChangedFromCache(previousEntries, nextEntries) {
  if (previousEntries.length !== nextEntries.length) {
    return true;
  }

  for (let index = 0; index < nextEntries.length; index += 1) {
    const previous = previousEntries[index];
    const next = nextEntries[index];

    if (!previous || !next) {
      return true;
    }

    if (JSON.stringify(previous.photo) !== JSON.stringify(next.photo)) {
      return true;
    }
  }

  return false;
}

function sortPhotos(left, right) {
  if (left.sortDate && right.sortDate && left.sortDate !== right.sortDate) {
    return right.sortDate.localeCompare(left.sortDate);
  }

  if (left.sortDate && !right.sortDate) {
    return -1;
  }

  if (!left.sortDate && right.sortDate) {
    return 1;
  }

  return left.sourceName.localeCompare(right.sourceName);
}

function buildAltText(slug, index) {
  const readableSlug = slug
    .split('-')
    .filter(Boolean)
    .join(' ')
    .trim();

  if (!readableSlug) {
    return {
      en: `Photograph ${index}`,
      zh: `摄影作品 ${index}`,
    };
  }

  const englishReadable = readableSlug.replace(/\b\w/g, (character) => character.toUpperCase());
  return {
    en: `Photograph ${englishReadable}`,
    zh: `摄影作品 ${englishReadable}`,
  };
}

function formatExif(parsedExif, dimensions, fallbackCapturedAt) {
  const location = formatLocation(parsedExif.latitude, parsedExif.longitude);

  return {
    camera: formatCameraName(parsedExif.make, parsedExif.model),
    lens: cleanString(parsedExif.lensModel),
    focalLength: formatMillimeters(parsedExif.focalLength),
    aperture: formatAperture(parsedExif.fNumber),
    shutterSpeed: formatShutterSpeed(parsedExif.exposureTime),
    iso: parsedExif.iso ? String(parsedExif.iso) : '',
    capturedAt: formatCapturedAt(parsedExif.dateTimeOriginal || parsedExif.dateTime || fallbackCapturedAt),
    dimensions:
      Number.isFinite(dimensions.width) && Number.isFinite(dimensions.height)
        ? `${dimensions.width} × ${dimensions.height}`
        : '',
    location,
  };
}

function resolveSourceCreatedAtMs(sourceStat) {
  if (Number.isFinite(sourceStat.birthtimeMs) && sourceStat.birthtimeMs > 0) {
    return sourceStat.birthtimeMs;
  }

  if (Number.isFinite(sourceStat.mtimeMs) && sourceStat.mtimeMs > 0) {
    return sourceStat.mtimeMs;
  }

  return 0;
}

function cleanString(value) {
  if (!value) {
    return '';
  }

  return String(value).replace(/\0/g, '').trim();
}

function formatCameraName(make, model) {
  const cleanedMake = cleanString(make);
  const cleanedModel = cleanString(model);
  const combinedRaw = compactJoin([cleanedMake, cleanedModel]);

  if (cameraModelAliases.has(combinedRaw)) {
    return cameraModelAliases.get(combinedRaw);
  }

  if (cameraModelAliases.has(cleanedModel)) {
    return cameraModelAliases.get(cleanedModel);
  }

  const normalizedMake = normalizeCameraMake(cleanedMake);
  const normalizedModel = normalizeCameraModel(cleanedMake, cleanedModel);

  if (!normalizedMake) {
    return normalizedModel;
  }

  if (!normalizedModel) {
    return normalizedMake;
  }

  if (normalizedModel.toLowerCase().startsWith(normalizedMake.toLowerCase())) {
    return normalizedModel;
  }

  return `${normalizedMake} ${normalizedModel}`;
}

function compactJoin(values) {
  const cleaned = values
    .map(cleanString)
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);

  return cleaned.join(' ');
}

function normalizeCameraMake(make) {
  const upperMake = make.toUpperCase();

  if (upperMake === 'NIKON CORPORATION' || upperMake === 'NIKON') {
    return 'Nikon';
  }

  if (upperMake === 'DJI') {
    return 'DJI';
  }

  if (!make) {
    return '';
  }

  return toTitleCaseWords(make);
}

function normalizeCameraModel(make, model) {
  if (!model) {
    return '';
  }

  const upperModel = model.toUpperCase();
  if (cameraModelAliases.has(upperModel)) {
    return cameraModelAliases.get(upperModel);
  }

  if (make.toUpperCase() === 'NIKON CORPORATION' || make.toUpperCase() === 'NIKON') {
    return normalizeNikonModel(model);
  }

  return model.trim();
}

function normalizeNikonModel(model) {
  const stripped = model.replace(/^NIKON\s+/i, '').trim();
  const formatted = stripped
    .replace(/_/g, '')
    .replace(/\b(\d+)\s*([A-Z]+)\b/g, '$1$2')
    .replace(/\bZ\s+(\d+)/i, 'Z$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (formatted === 'Z72') {
    return 'Nikon Z7II';
  }

  return `Nikon ${formatted}`;
}

function toTitleCaseWords(value) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatMillimeters(value) {
  if (!isFiniteNumber(value)) {
    return '';
  }

  return `${trimTrailingZeros(value)} mm`;
}

function formatAperture(value) {
  if (!isFiniteNumber(value)) {
    return '';
  }

  return `f/${trimTrailingZeros(value)}`;
}

function formatShutterSpeed(value) {
  if (!isFiniteNumber(value) || value <= 0) {
    return '';
  }

  if (value >= 1) {
    return `${trimTrailingZeros(value)} s`;
  }

  const reciprocal = Math.round(1 / value);
  if (reciprocal > 0) {
    return `1/${reciprocal} s`;
  }

  return `${trimTrailingZeros(value)} s`;
}

function formatCapturedAt(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string' && value.includes(':')) {
    const normalized = value.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    return normalized.replace('T', ' ').trim();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatLocation(latitude, longitude) {
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return '';
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function trimTrailingZeros(value) {
  return Number(value.toFixed(3)).toString();
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function getImageDimensions(filePath, buffer) {
  const detected = detectDimensionsFromBuffer(buffer);
  if (detected.width && detected.height) {
    return detected;
  }

  if (hasCommand('sips')) {
    try {
      const output = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', filePath], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const widthMatch = output.match(/pixelWidth:\s+(\d+)/);
      const heightMatch = output.match(/pixelHeight:\s+(\d+)/);
      return {
        width: widthMatch ? Number(widthMatch[1]) : 0,
        height: heightMatch ? Number(heightMatch[1]) : 0,
      };
    } catch (error) {
      return { width: 0, height: 0 };
    }
  }

  return { width: 0, height: 0 };
}

function detectDimensionsFromBuffer(buffer) {
  if (buffer.length < 24) {
    return { width: 0, height: 0 };
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return parseJpegDimensions(buffer);
  }

  if (buffer.toString('ascii', 0, 8) === '\x89PNG\r\n\x1a\n') {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (buffer.slice(0, 4).toString('ascii') === 'II*\x00' || buffer.slice(0, 4).toString('ascii') === 'MM\x00*') {
    const exif = parseTiffExif(buffer, 0);
    return {
      width: Number(exif.pixelXDimension || 0),
      height: Number(exif.pixelYDimension || 0),
    };
  }

  return { width: 0, height: 0 };
}

function parseJpegDimensions(buffer) {
  let offset = 2;

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      break;
    }

    const marker = buffer[offset + 1];
    const segmentLength = buffer.readUInt16BE(offset + 2);

    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + segmentLength;
  }

  return { width: 0, height: 0 };
}

function readExif(buffer) {
  if (buffer.length < 4) {
    return {};
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return parseJpegExif(buffer);
  }

  if (buffer.slice(0, 4).toString('ascii') === 'II*\x00' || buffer.slice(0, 4).toString('ascii') === 'MM\x00*') {
    return parseTiffExif(buffer, 0);
  }

  return {};
}

function parseJpegExif(buffer) {
  let offset = 2;

  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      break;
    }

    const marker = buffer[offset + 1];
    const segmentLength = buffer.readUInt16BE(offset + 2);

    if (marker === 0xe1 && buffer.toString('ascii', offset + 4, offset + 10) === 'Exif\0\0') {
      return parseTiffExif(buffer, offset + 10);
    }

    offset += 2 + segmentLength;
  }

  return {};
}

function parseTiffExif(buffer, tiffStart) {
  try {
    const byteOrder = buffer.toString('ascii', tiffStart, tiffStart + 2);
    const littleEndian = byteOrder === 'II';
    const readUInt16 = (offset) =>
      littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
    const readUInt32 = (offset) =>
      littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
    const firstIfdOffset = readUInt32(tiffStart + 4);
    const ifd0 = readIfd(buffer, tiffStart, tiffStart + firstIfdOffset, littleEndian);
    const exifIfd =
      ifd0[0x8769] && isFiniteNumber(ifd0[0x8769])
        ? readIfd(buffer, tiffStart, tiffStart + ifd0[0x8769], littleEndian)
        : {};
    const gpsIfd =
      ifd0[0x8825] && isFiniteNumber(ifd0[0x8825])
        ? readIfd(buffer, tiffStart, tiffStart + ifd0[0x8825], littleEndian)
        : {};

    return {
      make: cleanString(ifd0[0x010f]),
      model: cleanString(ifd0[0x0110]),
      lensModel: cleanString(exifIfd[0xa434]),
      fNumber: numberFromTag(exifIfd[0x829d]),
      exposureTime: numberFromTag(exifIfd[0x829a]),
      iso: numberFromTag(exifIfd[0x8827]),
      focalLength: numberFromTag(exifIfd[0x920a]),
      dateTimeOriginal: cleanString(exifIfd[0x9003]),
      dateTime: cleanString(ifd0[0x0132]),
      pixelXDimension: numberFromTag(exifIfd[0xa002]),
      pixelYDimension: numberFromTag(exifIfd[0xa003]),
      latitude: gpsToDecimal(gpsIfd[0x0001], gpsIfd[0x0002]),
      longitude: gpsToDecimal(gpsIfd[0x0003], gpsIfd[0x0004]),
    };
  } catch (error) {
    return {};
  }
}

function readIfd(buffer, tiffStart, ifdOffset, littleEndian) {
  const entryCount = littleEndian ? buffer.readUInt16LE(ifdOffset) : buffer.readUInt16BE(ifdOffset);
  const entries = {};

  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    const tag = littleEndian ? buffer.readUInt16LE(entryOffset) : buffer.readUInt16BE(entryOffset);
    const type = littleEndian ? buffer.readUInt16LE(entryOffset + 2) : buffer.readUInt16BE(entryOffset + 2);
    const count = littleEndian ? buffer.readUInt32LE(entryOffset + 4) : buffer.readUInt32BE(entryOffset + 4);
    const valueOffset = entryOffset + 8;
    entries[tag] = readExifValue(buffer, tiffStart, type, count, valueOffset, littleEndian);
  }

  return entries;
}

function readExifValue(buffer, tiffStart, type, count, valueOffset, littleEndian) {
  const typeSizes = {
    1: 1,
    2: 1,
    3: 2,
    4: 4,
    5: 8,
    7: 1,
    9: 4,
    10: 8,
  };

  const unitSize = typeSizes[type];
  if (!unitSize) {
    return null;
  }

  const valueLength = unitSize * count;
  const actualOffset =
    valueLength <= 4
      ? valueOffset
      : tiffStart + (littleEndian ? buffer.readUInt32LE(valueOffset) : buffer.readUInt32BE(valueOffset));

  const values = [];

  for (let index = 0; index < count; index += 1) {
    const itemOffset = actualOffset + index * unitSize;

    switch (type) {
      case 1:
      case 7:
        values.push(buffer.readUInt8(itemOffset));
        break;
      case 2:
        return buffer.toString('ascii', actualOffset, actualOffset + count).replace(/\0/g, '').trim();
      case 3:
        values.push(littleEndian ? buffer.readUInt16LE(itemOffset) : buffer.readUInt16BE(itemOffset));
        break;
      case 4:
        values.push(littleEndian ? buffer.readUInt32LE(itemOffset) : buffer.readUInt32BE(itemOffset));
        break;
      case 5:
        values.push(readRational(buffer, itemOffset, littleEndian, false));
        break;
      case 9:
        values.push(littleEndian ? buffer.readInt32LE(itemOffset) : buffer.readInt32BE(itemOffset));
        break;
      case 10:
        values.push(readRational(buffer, itemOffset, littleEndian, true));
        break;
      default:
        break;
    }
  }

  return count === 1 ? values[0] : values;
}

function readRational(buffer, offset, littleEndian, signed) {
  const numerator = signed
    ? littleEndian
      ? buffer.readInt32LE(offset)
      : buffer.readInt32BE(offset)
    : littleEndian
      ? buffer.readUInt32LE(offset)
      : buffer.readUInt32BE(offset);
  const denominator = signed
    ? littleEndian
      ? buffer.readInt32LE(offset + 4)
      : buffer.readInt32BE(offset + 4)
    : littleEndian
      ? buffer.readUInt32LE(offset + 4)
      : buffer.readUInt32BE(offset + 4);

  if (!denominator) {
    return 0;
  }

  return numerator / denominator;
}

function numberFromTag(value) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'number' ? value[0] : null;
  }

  return typeof value === 'number' ? value : null;
}

function gpsToDecimal(reference, values) {
  if (!reference || !Array.isArray(values) || values.length < 3) {
    return null;
  }

  const [degrees, minutes, seconds] = values;
  const sign = reference === 'S' || reference === 'W' ? -1 : 1;
  return sign * (degrees + minutes / 60 + seconds / 3600);
}

if (require.main === module) {
  main();
}

module.exports = {
  formatCameraName,
  formatCapturedAt,
};
