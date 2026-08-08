import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from './App';
import i18n from './i18n';

let container;
let root;
let wheelsPayload;

function clonePayload(value) {
  return JSON.parse(JSON.stringify(value));
}

async function waitForSelector(selector) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
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

async function waitForText(text) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (container.textContent.includes(text)) {
      return true;
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  return false;
}

function setInputValue(input, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function createFetchMock() {
  return vi.fn(async (url, options = {}) => {
    const target = String(url);

    if (!target.includes('/api/wheels')) {
      return {
        ok: true,
        json: async () => [],
      };
    }

    if (target === '/api/wheels' && (!options.method || options.method === 'GET')) {
      return {
        ok: true,
        json: async () => clonePayload(wheelsPayload),
      };
    }

    const match = target.match(/^\/api\/wheels\/([^/]+)(?:\/items\/?([^/]+)?)?$/);
    const wheelId = match?.[1];
    const itemId = match?.[2];
    const wheel = wheelsPayload.wheels.find((entry) => entry.id === wheelId);

    if (!wheel) {
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: 'Wheel not found.' }),
      };
    }

    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      const item = { id: `item-${Date.now()}`, label: body.label.trim() };
      wheel.items.push(item);
      return {
        ok: true,
        status: 201,
        json: async () => ({ wheel: clonePayload(wheel), item: clonePayload(item) }),
      };
    }

    if (options.method === 'PATCH') {
      const body = JSON.parse(options.body);
      const item = wheel.items.find((entry) => entry.id === itemId);
      item.label = body.label.trim();
      return {
        ok: true,
        json: async () => ({ wheel: clonePayload(wheel), item: clonePayload(item) }),
      };
    }

    if (options.method === 'DELETE') {
      const itemIndex = wheel.items.findIndex((entry) => entry.id === itemId);
      const [item] = wheel.items.splice(itemIndex, 1);
      return {
        ok: true,
        json: async () => ({ wheel: clonePayload(wheel), item: clonePayload(item) }),
      };
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found.' }),
    };
  });
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  i18n.changeLanguage('en');
  window.location.hash = '#/wheels';
  window.scrollTo = () => {};
  wheelsPayload = {
    wheels: [
      { id: 'brunch', label: 'Brunch', items: [] },
      { id: 'dinner', label: 'Dinner', items: [] },
      { id: 'boba', label: 'Boba', items: [] },
    ],
  };
  const fetchMock = createFetchMock();
  global.fetch = fetchMock;
  window.fetch = fetchMock;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  vi.useRealTimers();
  act(() => {
    root.unmount();
  });
  container.remove();
  container = null;
  root = null;
  window.location.hash = '#/';
  vi.restoreAllMocks();
});

test('renders the wheels route and switches between shared wheels', async () => {
  await act(async () => {
    root.render(<App />);
  });

  const heading = await waitForSelector('#wheels-section-title');
  const wheelsNav = container.querySelector('.site-nav-link[href="/#/wheels"]');
  const dinnerTab = Array.from(container.querySelectorAll('.wheel-tab')).find((button) =>
    button.textContent.includes('Dinner')
  );

  expect(heading && heading.textContent).toBe('Brunch');
  expect(wheelsNav && wheelsNav.textContent).toBe('Wheels');
  expect(wheelsNav.classList.contains('is-active')).toBe(true);
  expect(dinnerTab).toBeTruthy();

  act(() => {
    dinnerTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(container.querySelector('#wheels-section-title').textContent).toBe('Dinner');
});

test('shows an empty-state and disables spin when the selected wheel has no items', async () => {
  await act(async () => {
    root.render(<App />);
  });
  await waitForSelector('.wheel-empty-state');

  const spinButton = container.querySelector('.wheel-spin-button');
  expect(spinButton.disabled).toBe(true);
  expect(container.textContent).toContain('This wheel is empty');
});

test('adds, edits, and deletes items with the edit password header', async () => {
  await act(async () => {
    root.render(<App />);
  });
  await waitForSelector('.wheel-add-form');

  const passwordInput = container.querySelector('input[type="password"]');
  const addInput = container.querySelector('.wheel-add-form input[type="text"]');
  setInputValue(passwordInput, 'secret');
  setInputValue(addInput, 'Marugame');

  await act(async () => {
    container.querySelector('.wheel-add-form').dispatchEvent(new Event('submit', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(await waitForText('Marugame')).toBe(true);
  const postCall = global.fetch.mock.calls.find(
    ([url, options]) => String(url) === '/api/wheels/brunch/items' && options.method === 'POST'
  );
  expect(postCall[1].headers['x-wheels-admin-password']).toBe('secret');

  const editButton = Array.from(container.querySelectorAll('.wheel-small-button')).find((button) =>
    button.textContent.includes('Edit')
  );
  act(() => {
    editButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  const editInput = container.querySelector('.wheel-edit-form input');
  setInputValue(editInput, 'Tsujita');

  await act(async () => {
    container.querySelector('.wheel-edit-form').dispatchEvent(new Event('submit', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(await waitForText('Tsujita')).toBe(true);

  const deleteButton = Array.from(container.querySelectorAll('.wheel-small-button')).find((button) =>
    button.textContent.includes('Delete')
  );
  await act(async () => {
    deleteButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  const deleteCall = global.fetch.mock.calls.find(([, options]) => options.method === 'DELETE');
  expect(deleteCall[1].headers['x-wheels-admin-password']).toBe('secret');
  expect(container.textContent).toContain('This wheel is empty');
});

test('spins to an existing item without mutating the wheel', async () => {
  wheelsPayload.wheels[0].items = [
    { id: 'tacos', label: 'Tacos' },
    { id: 'ramen', label: 'Ramen' },
  ];
  vi.spyOn(Math, 'random').mockReturnValue(0.1);

  await act(async () => {
    root.render(<App />);
  });
  await waitForSelector('.wheel-spin-button');

  vi.useFakeTimers();
  act(() => {
    container.querySelector('.wheel-spin-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(container.querySelector('.wheel-dial').classList.contains('is-spinning')).toBe(true);
  expect(container.querySelector('.wheel-result').textContent).toContain('Spin the wheel');
  expect(container.textContent).not.toContain('Today: Tacos');

  act(() => {
    vi.advanceTimersByTime(2800);
  });

  expect(container.querySelector('.wheel-dial').classList.contains('is-spinning')).toBe(false);
  expect(container.textContent).toContain('Today: Tacos');
  expect(global.fetch.mock.calls.some(([, options = {}]) => options.method === 'DELETE')).toBe(false);
  expect(global.fetch.mock.calls.some(([, options = {}]) => options.method === 'PATCH')).toBe(false);
  expect(global.fetch.mock.calls.some(([, options = {}]) => options.method === 'POST')).toBe(false);
});
