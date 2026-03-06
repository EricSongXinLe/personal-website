import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from './App';
import i18n from './i18n';

const mockPhotos = [
  {
    id: 'golden-hour',
    slug: 'golden-hour',
    thumbSrc: '/images/headshot.jpg',
    fullSrc: '/images/headshot.jpg',
    width: 600,
    height: 600,
    alt: {
      en: 'Photograph Golden Hour',
      zh: '摄影作品 Golden Hour',
    },
    exif: {
      camera: 'Canon EOS R6',
      lens: 'RF24-70mm F2.8 L IS USM',
      focalLength: '35 mm',
      aperture: 'f/2.8',
      shutterSpeed: '1/250 s',
      iso: '200',
      capturedAt: '2025-07-21 18:42',
      dimensions: '600 × 600',
      location: '34.07000, -118.44000',
    },
  },
  {
    id: 'night-walk',
    slug: 'night-walk',
    thumbSrc: '/images/icon_camera.png',
    fullSrc: '/images/icon_camera.png',
    width: 900,
    height: 600,
    alt: {
      en: 'Photograph Night Walk',
      zh: '摄影作品 Night Walk',
    },
    exif: {
      camera: 'Fujifilm X100V',
      iso: '800',
      capturedAt: '2024-05-10 20:15',
      dimensions: '900 × 600',
    },
  },
  {
    id: 'coast-drive',
    slug: 'coast-drive',
    thumbSrc: '/images/icon_linkedin.png',
    fullSrc: '/images/icon_linkedin.png',
    width: 450,
    height: 600,
    alt: {
      en: 'Photograph Coast Drive',
      zh: '摄影作品 Coast Drive',
    },
    exif: {
      camera: 'Sony A7 IV',
      iso: '125',
      capturedAt: '2023-08-14 09:30',
      dimensions: '450 × 600',
    },
  },
  {
    id: 'desert-lines',
    slug: 'desert-lines',
    thumbSrc: '/images/icon_email.png',
    fullSrc: '/images/icon_email.png',
    width: 1200,
    height: 600,
    alt: {
      en: 'Photograph Desert Lines',
      zh: '摄影作品 Desert Lines',
    },
    exif: {
      camera: 'Nikon Z7II',
      iso: '64',
      capturedAt: '2022-02-03 07:05',
      dimensions: '1200 × 600',
    },
  },
];

let container;
let root;

async function waitForSelector(selector) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const node = container.querySelector(selector);

    if (node) {
      return node;
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  return null;
}

async function waitForRowCount(expectedCount) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (container.querySelectorAll('.photography-row').length === expectedCount) {
      return true;
    }

    await act(async () => {
      globalThis.__flushMockResizeObservers();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  return false;
}

async function flushGalleryLayout() {
  await act(async () => {
    globalThis.__flushMockResizeObservers();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function getTileOrder() {
  return Array.from(container.querySelectorAll('.photo-tile img')).map((node) => node.getAttribute('alt'));
}

beforeEach(() => {
  window.localStorage.clear();
  i18n.changeLanguage('en');
  window.location.hash = '#/photography';
  window.scrollTo = () => {};
  Object.defineProperty(window, 'innerWidth', {
    value: 780,
    configurable: true,
    writable: true,
  });
  globalThis.__setMockResizeObserverWidth(780);
  const fetchMock = vi.fn().mockImplementation(async () => ({
    ok: true,
    json: async () => mockPhotos,
  }));
  global.fetch = fetchMock;
  window.fetch = fetchMock;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  container = null;
  root = null;
  window.location.hash = '#/';
  Object.defineProperty(window, 'innerWidth', {
    value: 1024,
    configurable: true,
    writable: true,
  });
  globalThis.__setMockResizeObserverWidth(1200);
  vi.restoreAllMocks();
});

test('renders the photography route in row-major order and opens the lightbox with exif', async () => {
  await act(async () => {
    root.render(<App />);
  });
  await flushGalleryLayout();

  const galleryTitle = await waitForSelector('#photography-gallery-title');
  const hasExpectedRows = await waitForRowCount(2);
  const photoRows = container.querySelectorAll('.photography-row');
  const photoTiles = container.querySelectorAll('.photo-tile');

  expect(galleryTitle).toBeTruthy();
  expect(hasExpectedRows).toBe(true);
  expect(galleryTitle.textContent).toMatch(/selected work/i);
  expect(photoRows.length).toBe(2);
  expect(photoTiles.length).toBe(4);
  expect(getTileOrder()).toEqual([
    'Photograph Golden Hour',
    'Photograph Night Walk',
    'Photograph Coast Drive',
    'Photograph Desert Lines',
  ]);

  act(() => {
    photoTiles[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  const dialog = container.querySelector('.lightbox');
  const exifTitle = Array.from(container.querySelectorAll('.lightbox-sidebar h2')).find(
    (node) => node.textContent === 'EXIF'
  );
  const exifValues = Array.from(container.querySelectorAll('.exif-list dd')).map((node) =>
    node.textContent.trim()
  );

  expect(dialog).toBeTruthy();
  expect(exifTitle).toBeTruthy();
  expect(exifValues).toContain('Canon EOS R6');
  expect(exifValues).toContain('35 mm');
});

test('supports keyboard navigation and escape to close the lightbox in displayed order', async () => {
  await act(async () => {
    root.render(<App />);
  });
  await flushGalleryLayout();

  await waitForSelector('.photo-tile');
  const photoTiles = container.querySelectorAll('.photo-tile');

  act(() => {
    photoTiles[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  const initialImage = container.querySelector('.lightbox-image');
  expect(initialImage && initialImage.getAttribute('src')).toContain('/images/headshot.jpg');

  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  });

  const exifValuesAfterNext = Array.from(container.querySelectorAll('.exif-list dd')).map((node) =>
    node.textContent.trim()
  );
  const nextImage = container.querySelector('.lightbox-image');
  expect(exifValuesAfterNext).toContain('Fujifilm X100V');
  expect(nextImage && nextImage.getAttribute('src')).toContain('/images/icon_camera.png');

  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  expect(container.querySelector('.lightbox')).toBeNull();
});

test('toggles photo sort order and keeps lightbox navigation aligned with the new display order', async () => {
  await act(async () => {
    root.render(<App />);
  });
  await flushGalleryLayout();

  await waitForSelector('.photo-tile');

  const oldestFirstButton = Array.from(container.querySelectorAll('.photo-sort-button')).find((node) =>
    node.textContent.includes('Oldest first')
  );

  expect(oldestFirstButton).toBeTruthy();

  act(() => {
    oldestFirstButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(getTileOrder()).toEqual([
    'Photograph Desert Lines',
    'Photograph Coast Drive',
    'Photograph Night Walk',
    'Photograph Golden Hour',
  ]);

  const photoTiles = container.querySelectorAll('.photo-tile');
  act(() => {
    photoTiles[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  const initialImage = container.querySelector('.lightbox-image');
  expect(initialImage && initialImage.getAttribute('src')).toContain('/images/icon_email.png');

  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  });

  const nextImage = container.querySelector('.lightbox-image');
  expect(nextImage && nextImage.getAttribute('src')).toContain('/images/icon_linkedin.png');
});
