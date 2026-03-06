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
    thumbSrc: '/images/headshot.jpg',
    fullSrc: '/images/headshot.jpg',
    width: 600,
    height: 600,
    alt: {
      en: 'Photograph Night Walk',
      zh: '摄影作品 Night Walk',
    },
    exif: {
      camera: 'Fujifilm X100V',
      iso: '800',
      dimensions: '600 × 600',
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

beforeEach(() => {
  window.localStorage.clear();
  i18n.changeLanguage('en');
  window.location.hash = '#/photography';
  window.scrollTo = () => {};
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
  vi.restoreAllMocks();
});

test('renders the photography route and opens the lightbox with exif', async () => {
  await act(async () => {
    root.render(<App />);
  });

  const galleryTitle = await waitForSelector('#photography-gallery-title');
  const photoTiles = container.querySelectorAll('.photo-tile');

  expect(galleryTitle).toBeTruthy();
  expect(galleryTitle.textContent).toMatch(/selected work/i);
  expect(photoTiles.length).toBe(2);

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

test('supports keyboard navigation and escape to close the lightbox', async () => {
  await act(async () => {
    root.render(<App />);
  });

  await waitForSelector('.photo-tile');
  const photoTiles = container.querySelectorAll('.photo-tile');
  act(() => {
    photoTiles[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  });

  const exifValuesAfterNext = Array.from(container.querySelectorAll('.exif-list dd')).map((node) =>
    node.textContent.trim()
  );
  expect(exifValuesAfterNext).toContain('Fujifilm X100V');

  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  expect(container.querySelector('.lightbox')).toBeNull();
});
