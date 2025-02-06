import React, { useState } from 'react';
import './App.css';
import { useTranslation } from 'react-i18next';
import './i18n'; 

function App() {
  const { t, i18n } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  let timer; 

  const handleMouseEnter = () => {
    clearTimeout(timer); 
    setIsDropdownOpen(true); 
  };

  const handleMouseLeave = () => {
    timer = setTimeout(() => setIsDropdownOpen(false), 100); 
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng); 
    setIsDropdownOpen(false);
  };

  return (
    <div className="container">
      <div
        className="language-selector"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="language-button">🌐 Language</div>
        <div className={`dropdown ${isDropdownOpen ? 'visible' : ''}`}>
          <button onClick={() => changeLanguage('en')}>English</button>
          <button onClick={() => changeLanguage('zh')}>中文</button>
        </div>
      </div>
      <h1 className="font-italic">{t('title')}</h1>
      <hr />
      <h3>{t('aboutMe')}</h3>
      <p>{t('description')}</p>
      <img
        className="headshot"
        src="./images/headshot.jpg"
        alt="Eric"
        width="250"
        height="250"
      />
      <div className="links">
        <a href={t('resumeLinkAlt')}>
          <img className="linkImage" src="./images/icon_cv.png" alt={t('cvAlt')} width="50" height="50" />
        </a>
        <a href="https://www.linkedin.com/in/xinle-song/">
          <img className="linkImage" src="./images/icon_linkedin.png" alt={t('linkedinAlt')} width="50" height="50" />
        </a>
        <a href="https://github.com/EricSongXinLe/">
          <img className="linkImage" src="./images/icon_github.png" alt={t('githubAlt')} width="50" height="50" />
        </a>
        <a href="https://www.flickr.com/photos/196818188@N02/">
          <img className="linkImage" src="./images/icon_camera.png" alt={t('flickrAlt')} width="50" height="50" />
        </a>
        <a href="mailto:erics311@ucla.edu">
          <img className="linkImage" src="./images/icon_email.png" alt={t('emailAlt')} width="50" height="50" />
        </a>
      </div>
      <hr />
    </div>
  );
}

export default App;