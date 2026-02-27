import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test } from 'vitest';
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
  const aboutSection = Array.from(container.querySelectorAll('h2')).find(
    (node) => node.textContent === 'About Me'
  );
  const githubLink = container.querySelector('.link-pill[href="https://github.com/EricSongXinLe/"]');
  const subtitle = container.querySelector('.subtitle');

  expect(heading && heading.textContent).toMatch(/hey, this is eric!/i);
  expect(subtitle && subtitle.textContent).toMatch(/computer engineering student at ucla/i);
  expect(aboutSection).toBeTruthy();
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
  const chineseOption = languageOptions.find((button) => button.textContent.includes('中文'));
  expect(chineseOption).toBeTruthy();
  act(() => {
    chineseOption.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  const chineseHeading = container.querySelector('h1');
  const chineseSubtitle = container.querySelector('.subtitle');
  expect(chineseHeading && chineseHeading.textContent).toMatch(/嗨，我是 Eric!/);
  expect(chineseSubtitle && chineseSubtitle.textContent).toMatch(/UCLA 计算机工程专业学生/);
});
