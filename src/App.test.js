import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import i18n from './i18n';

let container;
let root;

beforeEach(() => {
  window.localStorage.clear();
  i18n.changeLanguage('en');
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
});

test('renders the main profile content', () => {
  act(() => {
    root.render(<App />);
  });

  const heading = container.querySelector('h1');
  const aboutSection = container.querySelector('h2');
  const githubLink = container.querySelector('a[href="https://github.com/EricSongXinLe/"]');

  expect(heading && heading.textContent).toMatch(/hey, this is eric!/i);
  expect(aboutSection && aboutSection.textContent).toMatch(/about me/i);
  expect(githubLink).toBeTruthy();
});

test('changes language through the language menu', () => {
  act(() => {
    root.render(<App />);
  });

  const languageButton = container.querySelector('.language-button');
  expect(languageButton).toBeTruthy();
  act(() => {
    languageButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  const languageOptions = Array.from(container.querySelectorAll('.dropdown button'));
  const chineseOption = languageOptions.find((button) => button.textContent === '中文');
  expect(chineseOption).toBeTruthy();
  act(() => {
    chineseOption.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  const chineseHeading = container.querySelector('h1');
  expect(chineseHeading && chineseHeading.textContent).toMatch(/嗨，我是 Eric!/);
});
