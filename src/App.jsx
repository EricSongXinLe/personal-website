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
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const getAssetPath = (assetPath) => `${normalizedBase}${assetPath.replace(/^\//, '')}`;

  const profileLinks = [
    {
      href: getAssetPath(t('resumeLinkAlt')),
      label: t('cvAlt'),
      icon: getAssetPath('images/icon_cv.png'),
      external: true,
    },
    {
      href: 'https://www.linkedin.com/in/xinle-song/',
      label: t('linkedinAlt'),
      icon: getAssetPath('images/icon_linkedin.png'),
      external: true,
    },
    {
      href: 'https://github.com/EricSongXinLe/',
      label: t('githubAlt'),
      icon: getAssetPath('images/icon_github.png'),
      external: true,
    },
    {
      href: 'https://www.flickr.com/photos/196818188@N02/',
      label: t('flickrAlt'),
      icon: getAssetPath('images/icon_camera.png'),
      external: true,
    },
    {
      href: 'mailto:erics311@ucla.edu',
      label: t('emailAlt'),
      icon: getAssetPath('images/icon_email.png'),
      external: false,
    },
  ];

  return (
    <div className="page-shell">
      <main className="container">
        <header className="hero">
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
                <span className="language-check" aria-hidden="true">
                  {isEnglishSelected ? '✓' : ''}
                </span>
                <span>English</span>
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={isChineseSelected}
                onClick={() => changeLanguage('zh')}
              >
                <span className="language-check" aria-hidden="true">
                  {isChineseSelected ? '✓' : ''}
                </span>
                <span>中文</span>
              </button>
            </div>
          </div>
          <p className="eyebrow">{t('aboutLabel')}</p>
          <h1>{t('title')}</h1>
          <p className="subtitle">{t('subtitle')}</p>
        </header>

        <section className="profile" aria-label={t('headshotAlt')}>
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
        </section>

        <section className="about" aria-labelledby="about-title">
          <h2 id="about-title">{t('aboutMe')}</h2>
          <p>{t('description')}</p>
        </section>

        <section className="links-section" aria-labelledby="links-title">
          <h2 id="links-title">{t('linksTitle')}</h2>
          <div className="links" aria-label={t('linksLabel')}>
            {profileLinks.map((link) => (
              <a
                key={link.label}
                className="link-pill"
                href={link.href}
                aria-label={link.label}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
              >
                <img className="linkImage" src={link.icon} alt="" width="40" height="40" />
                <span className="linkText">{link.label}</span>
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
