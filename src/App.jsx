import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import { useTranslation } from 'react-i18next';
import './i18n';

function App() {
  const { t, i18n } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem('preferredLanguage');
    if (savedLanguage === 'en' || savedLanguage === 'zh') {
      i18n.changeLanguage(savedLanguage);
    }
  }, [i18n]);

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  useEffect(() => {
    const handleDocumentMouseDown = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
      document.removeEventListener('keydown', handleEscape);
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => setIsDropdownOpen(false), 120);
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    window.localStorage.setItem('preferredLanguage', lng);
    setIsDropdownOpen(false);
  };

  const language = i18n.resolvedLanguage || i18n.language;
  const isEnglishSelected = language.startsWith('en');
  const isChineseSelected = language.startsWith('zh');
  const baseUrl = import.meta.env.BASE_URL || '/';
  const getAssetPath = (assetPath) => `${baseUrl}${assetPath}`;

  return (
    <div className="container">
      <div
        className="language-selector"
        ref={dropdownRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          type="button"
          className="language-button"
          onClick={() => setIsDropdownOpen((open) => !open)}
          aria-haspopup="true"
          aria-expanded={isDropdownOpen}
          aria-label={t('languageLabel')}
        >
          <span aria-hidden="true">🌐</span>
          <span>{t('languageLabel')}</span>
        </button>
        <div
          className={`dropdown ${isDropdownOpen ? 'visible' : ''}`}
          role="menu"
          aria-label={t('languageLabel')}
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={isEnglishSelected}
            onClick={() => changeLanguage('en')}
          >
            English
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={isChineseSelected}
            onClick={() => changeLanguage('zh')}
          >
            中文
          </button>
        </div>
      </div>
      <h1>{t('title')}</h1>
      <hr />
      <h2>{t('aboutMe')}</h2>
      <p>{t('description')}</p>
      <picture>
        <source srcSet={getAssetPath('images/headshot.webp')} type="image/webp" />
        <img
          className="headshot"
          src={getAssetPath('images/headshot.jpg')}
          alt={t('headshotAlt')}
          width="250"
          height="250"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      </picture>
      <div className="links" aria-label={t('linksLabel')}>
        <a
          href={getAssetPath(t('resumeLinkAlt'))}
          aria-label={t('cvAlt')}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            className="linkImage"
            src={getAssetPath('images/icon_cv.png')}
            alt=""
            width="50"
            height="50"
          />
        </a>
        <a
          href="https://www.linkedin.com/in/xinle-song/"
          aria-label={t('linkedinAlt')}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            className="linkImage"
            src={getAssetPath('images/icon_linkedin.png')}
            alt=""
            width="50"
            height="50"
          />
        </a>
        <a
          href="https://github.com/EricSongXinLe/"
          aria-label={t('githubAlt')}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            className="linkImage"
            src={getAssetPath('images/icon_github.png')}
            alt=""
            width="50"
            height="50"
          />
        </a>
        <a
          href="https://www.flickr.com/photos/196818188@N02/"
          aria-label={t('flickrAlt')}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            className="linkImage"
            src={getAssetPath('images/icon_camera.png')}
            alt=""
            width="50"
            height="50"
          />
        </a>
        <a href="mailto:erics311@ucla.edu" aria-label={t('emailAlt')}>
          <img
            className="linkImage"
            src={getAssetPath('images/icon_email.png')}
            alt=""
            width="50"
            height="50"
          />
        </a>
      </div>
      <hr />
    </div>
  );
}

export default App;
