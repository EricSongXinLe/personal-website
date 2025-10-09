import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import { useTranslation } from 'react-i18next';
import './i18n';

function App() {
  const { t, i18n } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownTimer = useRef(null);

  const skills = t('skills', { returnObjects: true });
  const highlightItems = t('highlights', { returnObjects: true });
  const skillList = Array.isArray(skills) ? skills : [];
  const highlightList = Array.isArray(highlightItems) ? highlightItems : [];

  const socialLinks = [
    {
      href: 'https://www.linkedin.com/in/xinle-song/',
      icon: './images/icon_linkedin.png',
      label: t('linkedinAlt'),
    },
    {
      href: 'https://github.com/EricSongXinLe/',
      icon: './images/icon_github.png',
      label: t('githubAlt'),
    },
    {
      href: 'https://www.flickr.com/photos/196818188@N02/',
      icon: './images/icon_camera.png',
      label: t('flickrAlt'),
    },
    {
      href: 'mailto:erics311@ucla.edu',
      icon: './images/icon_email.png',
      label: t('emailAlt'),
    },
  ];

  const handleMouseEnter = () => {
    if (dropdownTimer.current) {
      clearTimeout(dropdownTimer.current);
    }
    setIsDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    dropdownTimer.current = setTimeout(() => setIsDropdownOpen(false), 120);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setIsDropdownOpen(false);
  };

  useEffect(() => {
    return () => {
      if (dropdownTimer.current) {
        clearTimeout(dropdownTimer.current);
      }
    };
  }, []);

  return (
    <div className="app">
      <div className="floating-shape shape-one" aria-hidden="true" />
      <div className="floating-shape shape-two" aria-hidden="true" />
      <div
        className="language-selector"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          type="button"
          className="language-button"
          onClick={toggleDropdown}
          aria-haspopup="true"
          aria-expanded={isDropdownOpen}
        >
          <span role="img" aria-hidden="true">
            🌐
          </span>{' '}
          {t('languageLabel')}
        </button>
        <div className={`dropdown ${isDropdownOpen ? 'visible' : ''}`}>
          <button type="button" onClick={() => changeLanguage('en')}>
            English
          </button>
          <button type="button" onClick={() => changeLanguage('zh')}>
            中文
          </button>
        </div>
      </div>
      <main className="content">
        <section className="hero">
          <div className="hero-text">
            <span className="badge">{t('badge')}</span>
            <h1>{t('title')}</h1>
            <p className="hero-tagline">{t('tagline')}</p>
            <p className="hero-description">{t('introduction')}</p>
            <div className="hero-actions">
              <a
                className="btn btn-primary"
                href={t('resumeLink')}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('actions.resume')}
              </a>
              <a className="btn btn-secondary" href="mailto:erics311@ucla.edu">
                {t('actions.contact')}
              </a>
            </div>
            <div className="skill-chips" aria-label={t('skillsHeading')}>
              <span className="section-label">{t('skillsHeading')}</span>
              <div className="chip-group">
                {skillList.map((skill) => (
                    <span className="chip" key={skill}>
                      {skill}
                    </span>
                  ))}
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="photo-frame">
              <img
                className="headshot"
                src="./images/headshot.jpg"
                alt={t('headshotAlt')}
                width="280"
                height="280"
              />
            </div>
            <div className="social-links" role="list">
              {socialLinks.map(({ href, icon, label }) => (
                <a
                  key={href}
                  className="social-link"
                  href={href}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  role="listitem"
                >
                  <span className="social-icon">
                    <img src={icon} alt="" aria-hidden="true" />
                  </span>
                  <span className="social-label">{label}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="info-card about">
          <h2>{t('aboutHeading')}</h2>
          <p>{t('aboutBody')}</p>
        </section>

        <section className="highlights">
          <div className="section-header">
            <h2>{t('highlightsHeading')}</h2>
          </div>
          <div className="highlight-grid">
            {highlightList.map((item, index) => (
                <article className="highlight-card" key={`${item.title}-${index}`}>
                  <span className="highlight-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
          </div>
        </section>

        <section className="info-card contact">
          <h2>{t('contactHeading')}</h2>
          <p>{t('contactBody')}</p>
          <a className="btn btn-primary" href="mailto:erics311@ucla.edu">
            {t('contactCta')}
          </a>
        </section>
      </main>
    </div>
  );
}

export default App;
