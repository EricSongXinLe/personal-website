import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { useTranslation } from 'react-i18next';
import './i18n';
import { featuredProjects } from './data/featuredProjects';

const ROUTES = {
  home: '/',
  photography: '/photography',
};

const EXIF_FIELD_ORDER = [
  { key: 'camera', labelKey: 'photoExifCamera' },
  { key: 'lens', labelKey: 'photoExifLens' },
  { key: 'focalLength', labelKey: 'photoExifFocalLength' },
  { key: 'aperture', labelKey: 'photoExifAperture' },
  { key: 'shutterSpeed', labelKey: 'photoExifShutterSpeed' },
  { key: 'iso', labelKey: 'photoExifIso' },
  { key: 'capturedAt', labelKey: 'photoExifCapturedAt' },
  { key: 'dimensions', labelKey: 'photoExifDimensions' },
  { key: 'location', labelKey: 'photoExifLocation' },
];

function getRouteFromHash(hash) {
  const normalizedHash = hash.replace(/^#/, '') || ROUTES.home;
  return normalizedHash === ROUTES.photography ? ROUTES.photography : ROUTES.home;
}

function getLocalizedText(value, language) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  return value[language] || value.en || value.zh || '';
}

function getNextPhotoIndex(currentIndex, photosCount, delta) {
  if (currentIndex === null || photosCount === 0) {
    return currentIndex;
  }

  return (currentIndex + delta + photosCount) % photosCount;
}

function App() {
  const { t, i18n } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [route, setRoute] = useState(() => getRouteFromHash(window.location.hash));
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
  const [photoLibrary, setPhotoLibrary] = useState([]);
  const [isPhotosLoading, setIsPhotosLoading] = useState(true);
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

    const handleHashChange = () => {
      setRoute(getRouteFromHash(window.location.hash));
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
      window.removeEventListener('hashchange', handleHashChange);
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (route !== ROUTES.photography) {
      setSelectedPhotoIndex(null);
    }

    if (typeof window.scrollTo === 'function') {
      window.scrollTo(0, 0);
    }
  }, [route]);

  useEffect(() => {
    if (selectedPhotoIndex === null) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedPhotoIndex(null);
      }

      if (event.key === 'ArrowRight') {
        setSelectedPhotoIndex((current) => getNextPhotoIndex(current, photoLibrary.length, 1));
      }

      if (event.key === 'ArrowLeft') {
        setSelectedPhotoIndex((current) => getNextPhotoIndex(current, photoLibrary.length, -1));
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedPhotoIndex, photoLibrary.length]);

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
  const currentLang = language.startsWith('zh') ? 'zh' : 'en';
  const isEnglishSelected = currentLang === 'en';
  const isChineseSelected = currentLang === 'zh';
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const getAssetPath = (assetPath) => `${normalizedBase}${assetPath.replace(/^\//, '')}`;
  const getRouteHref = (path) => `${normalizedBase}#${path}`;

  useEffect(() => {
    const controller = new AbortController();

    async function loadPhotoLibrary() {
      setIsPhotosLoading(true);

      try {
        const response = await fetch(getAssetPath('photos/generated/photos.json'), {
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`Failed to load photography manifest (${response.status})`);
        }

        const payload = await response.json();
        setPhotoLibrary(Array.isArray(payload) ? payload : []);
      } catch (error) {
        if (error.name !== 'AbortError') {
          setPhotoLibrary([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsPhotosLoading(false);
        }
      }
    }

    loadPhotoLibrary();

    return () => controller.abort();
  }, [normalizedBase]);

  const projectsToShow = featuredProjects.filter((project) => project.featured).slice(0, 3);
  const photos = useMemo(
    () =>
      photoLibrary.map((photo) => ({
        ...photo,
        localizedAlt: getLocalizedText(photo.alt, currentLang),
      })),
    [currentLang, photoLibrary]
  );
  const selectedPhoto = selectedPhotoIndex === null ? null : photos[selectedPhotoIndex];

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
    <div className={`page-shell ${route === ROUTES.photography ? 'page-shell--photography' : ''}`}>
      <main
        className={`container ${
          route === ROUTES.photography ? 'container--photography' : 'container--profile'
        }`}
      >
        <div className="site-toolbar">
          <nav className="site-nav" aria-label={t('siteNavigationLabel')}>
            <a
              className={`site-nav-link ${route === ROUTES.home ? 'is-active' : ''}`}
              href={getRouteHref(ROUTES.home)}
              aria-current={route === ROUTES.home ? 'page' : undefined}
            >
              {t('navProfile')}
            </a>
            <a
              className={`site-nav-link ${route === ROUTES.photography ? 'is-active' : ''}`}
              href={getRouteHref(ROUTES.photography)}
              aria-current={route === ROUTES.photography ? 'page' : undefined}
            >
              {t('navPhotography')}
            </a>
          </nav>

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
        </div>

        {route === ROUTES.photography ? (
          <PhotographyView
            currentLang={currentLang}
            getAssetPath={getAssetPath}
            isPhotosLoading={isPhotosLoading}
            onPhotoSelect={setSelectedPhotoIndex}
            photos={photos}
            t={t}
          />
        ) : (
          <ProfileView
            currentLang={currentLang}
            getAssetPath={getAssetPath}
            profileLinks={profileLinks}
            projectsToShow={projectsToShow}
            t={t}
          />
        )}
      </main>

      {selectedPhoto ? (
        <PhotoLightbox
          currentIndex={selectedPhotoIndex}
          getAssetPath={getAssetPath}
          onClose={() => setSelectedPhotoIndex(null)}
          onNext={() => setSelectedPhotoIndex((current) => getNextPhotoIndex(current, photos.length, 1))}
          onPrevious={() => setSelectedPhotoIndex((current) => getNextPhotoIndex(current, photos.length, -1))}
          photo={selectedPhoto}
          photosCount={photos.length}
          t={t}
        />
      ) : null}
    </div>
  );
}

function ProfileView({ currentLang, getAssetPath, profileLinks, projectsToShow, t }) {
  return (
    <div className="profile-layout">
      <header className="hero">
        <p className="eyebrow">{t('aboutLabel')}</p>
        <h1>{t('title')}</h1>
        <p className="subtitle">{t('subtitle')}</p>
      </header>

      <section className="profile" aria-label={t('headshotAlt')}>
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

      <section className="projects-section" aria-labelledby="projects-title">
        <div className="projects-header">
          <h2 id="projects-title">{t('projectsTitle')}</h2>
          <p className="projects-subtitle">{t('projectsSubtitle')}</p>
        </div>
        <div className="projects-grid">
          {projectsToShow.map((project) => (
            <article key={project.id} className="project-card">
              <h3>{project.name}</h3>
              <p>{project.summary[currentLang]}</p>
              <ul className="project-tech-list" aria-label={`${project.name} tech stack`}>
                {project.tech.map((techItem) => (
                  <li key={techItem}>{techItem}</li>
                ))}
              </ul>
              <div className="project-actions">
                <a href={project.repoUrl} target="_blank" rel="noopener noreferrer">
                  {t('projectRepoLabel')}
                </a>
                {project.demoUrl ? (
                  <a href={project.demoUrl} target="_blank" rel="noopener noreferrer">
                    {t('projectDemoLabel')}
                  </a>
                ) : (
                  <span className="project-soon">{t('projectComingSoonLabel')}</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function PhotographyView({ getAssetPath, isPhotosLoading, onPhotoSelect, photos, t }) {
  return (
    <div className="photography-layout">
      <header className="photography-hero">
        <p className="eyebrow">{t('photographyEyebrow')}</p>
        <h1>{t('photographyTitle')}</h1>
        <p className="subtitle">{t('photographySubtitle')}</p>
      </header>

      {isPhotosLoading ? (
        <section className="photo-empty-state" aria-live="polite">
          <h2>{t('photographyLoadingTitle')}</h2>
          <p>{t('photographyLoadingBody')}</p>
        </section>
      ) : photos.length > 0 ? (
        <section className="photography-gallery-section" aria-labelledby="photography-gallery-title">
          <div className="photography-section-heading">
            <h2 id="photography-gallery-title">{t('photographySectionTitle')}</h2>
            <p className="photography-count">
              {photos.length} {t('photographyCountLabel')}
            </p>
          </div>

          <div className="photography-grid" aria-label={t('photographyGridLabel')}>
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                className="photo-tile"
                onClick={() => onPhotoSelect(index)}
                aria-label={t('photoOpenLabel', { index: index + 1 })}
              >
                <img
                  src={getAssetPath(photo.thumbSrc)}
                  alt={photo.localizedAlt}
                  width={photo.width}
                  height={photo.height}
                  loading="lazy"
                  decoding="async"
                />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="photo-empty-state" aria-live="polite">
          <h2>{t('photographyEmptyTitle')}</h2>
          <p>{t('photographyEmptyBody')}</p>
          <p className="photo-empty-state-hint">
            <code>photos/originals</code>
            <span>{t('photographyEmptyDivider')}</span>
            <code>npm run generate:photos</code>
          </p>
        </section>
      )}
    </div>
  );
}

function PhotoLightbox({ currentIndex, getAssetPath, onClose, onNext, onPrevious, photo, photosCount, t }) {
  const [isMobileExifOpen, setIsMobileExifOpen] = useState(false);
  const exifItems = EXIF_FIELD_ORDER.map((field) => ({
    key: field.key,
    label: t(field.labelKey),
    value: photo.exif?.[field.key],
  })).filter((field) => field.value);

  useEffect(() => {
    setIsMobileExifOpen(false);
  }, [photo.id]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={t('photoLightboxLabel')}>
      <button
        type="button"
        className="lightbox-backdrop"
        aria-label={t('photoCloseLabel')}
        onClick={onClose}
      />

      <div className="lightbox-panel">
        <div className="lightbox-media">
          <button
            type="button"
            className="lightbox-nav lightbox-nav--previous"
            onClick={onPrevious}
            aria-label={t('photoPreviousLabel')}
          >
            ‹
          </button>

          <img
            key={photo.id}
            className="lightbox-image"
            src={getAssetPath(photo.fullSrc)}
            alt={photo.localizedAlt}
            width={photo.width}
            height={photo.height}
            loading="eager"
            decoding="async"
          />

          <button
            type="button"
            className="lightbox-mobile-toggle"
            onClick={() => setIsMobileExifOpen((open) => !open)}
            aria-expanded={isMobileExifOpen}
            aria-controls="lightbox-sidebar"
          >
            {isMobileExifOpen ? t('photoHideDetailsButton') : t('photoShowDetailsButton')}
          </button>

          <button
            type="button"
            className="lightbox-nav lightbox-nav--next"
            onClick={onNext}
            aria-label={t('photoNextLabel')}
          >
            ›
          </button>
        </div>

        <aside
          id="lightbox-sidebar"
          className={`lightbox-sidebar ${isMobileExifOpen ? 'is-open' : ''}`}
        >
          <div className="lightbox-sidebar-header">
            <p className="lightbox-counter">
              {currentIndex + 1} / {photosCount}
            </p>
            <button
              type="button"
              className="lightbox-close"
              onClick={onClose}
              aria-label={t('photoCloseLabel')}
            >
              ×
            </button>
          </div>

          <h2>{t('photoExifTitle')}</h2>

          {exifItems.length > 0 ? (
            <dl className="exif-list">
              {exifItems.map((field) => (
                <React.Fragment key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </React.Fragment>
              ))}
            </dl>
          ) : (
            <p className="exif-empty">{t('photoExifUnavailable')}</p>
          )}
        </aside>
      </div>
    </div>
  );
}

export default App;
