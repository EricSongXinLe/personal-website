import React, { useState } from 'react';
import './App.css';
import { useTranslation } from 'react-i18next';
import './i18n';

function App() {
  const { t, i18n } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  const closeDropdown = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDropdownOpen(false);
    }
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setIsDropdownOpen(false);
  };

  return (
    <div className="app">
      <div className="language-switcher" onBlur={closeDropdown}>
        <button
          type="button"
          className="language-button"
          onClick={toggleDropdown}
          aria-haspopup="true"
          aria-expanded={isDropdownOpen}
        >
          <span aria-hidden="true">🌐</span> Language
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
      <main className="card">
        <img
          className="headshot"
          src="./images/headshot.jpg"
          alt="Eric"
          width="220"
          height="220"
        />
        <h1>{t('title')}</h1>
        <div className="divider" aria-hidden="true" />
        <h2>{t('aboutMe')}</h2>
        <p>{t('description')}</p>
        <nav className="links" aria-label="Social links">
          <a href={t('resumeLinkAlt')}>
            <img className="linkImage" src="./images/icon_cv.png" alt={t('cvAlt')} width="40" height="40" />
          </a>
          <a href="https://www.linkedin.com/in/xinle-song/" target="_blank" rel="noopener noreferrer">
            <img className="linkImage" src="./images/icon_linkedin.png" alt={t('linkedinAlt')} width="40" height="40" />
          </a>
          <a href="https://github.com/EricSongXinLe/" target="_blank" rel="noopener noreferrer">
            <img className="linkImage" src="./images/icon_github.png" alt={t('githubAlt')} width="40" height="40" />
          </a>
          <a href="https://www.flickr.com/photos/196818188@N02/" target="_blank" rel="noopener noreferrer">
            <img className="linkImage" src="./images/icon_camera.png" alt={t('flickrAlt')} width="40" height="40" />
          </a>
          <a href="mailto:erics311@ucla.edu">
            <img className="linkImage" src="./images/icon_email.png" alt={t('emailAlt')} width="40" height="40" />
          </a>
        </nav>
      </main>
    </div>
  );
}

export default App;
