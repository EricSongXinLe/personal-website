import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { useTranslation } from 'react-i18next';
import './i18n';
import { featuredProjects } from './data/featuredProjects';
import { buildJustifiedRows, getTargetRowHeight, PHOTO_LAYOUT_FALLBACK_GAP } from './photoLayout';

const ROUTES = {
  home: '/',
  photography: '/photography',
  wheels: '/wheels',
};

const WHEELS_API_BASE = '/api/wheels';
const WHEELS_PASSWORD_STORAGE_KEY = 'wheelsAdminPassword';
const WHEEL_SPIN_ANIMATION_MS = 2800;

const WHEEL_TYPES = [
  { id: 'brunch', labelKey: 'wheelsBrunchLabel' },
  { id: 'dinner', labelKey: 'wheelsDinnerLabel' },
  { id: 'boba', labelKey: 'wheelsBobaLabel' },
];

const PHOTO_SORT_ORDERS = {
  newest: 'newest',
  oldest: 'oldest',
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

  if (Object.values(ROUTES).includes(normalizedHash)) {
    return normalizedHash;
  }

  return ROUTES.home;
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

function getPhotoCapturedAt(photo) {
  return photo.exif?.capturedAt || '';
}

function sortPhotosForDisplay(entries, sortOrder) {
  return [...entries].sort((left, right) => {
    const leftCapturedAt = getPhotoCapturedAt(left.photo);
    const rightCapturedAt = getPhotoCapturedAt(right.photo);

    if (leftCapturedAt && rightCapturedAt && leftCapturedAt !== rightCapturedAt) {
      return sortOrder === PHOTO_SORT_ORDERS.oldest
        ? leftCapturedAt.localeCompare(rightCapturedAt)
        : rightCapturedAt.localeCompare(leftCapturedAt);
    }

    if (leftCapturedAt && !rightCapturedAt) {
      return -1;
    }

    if (!leftCapturedAt && rightCapturedAt) {
      return 1;
    }

    return left.index - right.index;
  });
}

function parseGapValue(rawValue) {
  const parsedValue = Number.parseFloat(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : PHOTO_LAYOUT_FALLBACK_GAP;
}

function usePhotographyGalleryMetrics(isEnabled) {
  const galleryRef = useRef(null);
  const [metrics, setMetrics] = useState({
    width: 0,
    gap: PHOTO_LAYOUT_FALLBACK_GAP,
  });

  useLayoutEffect(() => {
    if (!isEnabled) {
      setMetrics((currentMetrics) => ({
        ...currentMetrics,
        width: 0,
      }));
      return undefined;
    }

    const node = galleryRef.current;

    if (!node) {
      return undefined;
    }

    const measure = (explicitWidth) => {
      const computedStyles =
        typeof window.getComputedStyle === 'function' ? window.getComputedStyle(node) : null;
      const measuredGap = computedStyles
        ? parseGapValue(computedStyles.columnGap || computedStyles.gap)
        : PHOTO_LAYOUT_FALLBACK_GAP;
      const fallbackWidth =
        node.clientWidth ||
        node.parentElement?.getBoundingClientRect().width ||
        window.innerWidth ||
        document.documentElement.clientWidth ||
        0;
      const rawWidth = explicitWidth ?? node.getBoundingClientRect().width;
      const measuredWidth = Math.max(rawWidth || fallbackWidth, 0);

      setMetrics((currentMetrics) => {
        if (currentMetrics.width === measuredWidth && currentMetrics.gap === measuredGap) {
          return currentMetrics;
        }

        return {
          width: measuredWidth,
          gap: measuredGap,
        };
      });
    };

    measure();

    if (typeof ResizeObserver !== 'function') {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      measure(entry?.contentRect?.width);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [isEnabled]);

  return [galleryRef, metrics];
}

function App() {
  const { t, i18n } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [route, setRoute] = useState(() => getRouteFromHash(window.location.hash));
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
  const [photoLibrary, setPhotoLibrary] = useState([]);
  const [isPhotosLoading, setIsPhotosLoading] = useState(true);
  const [photoSortOrder, setPhotoSortOrder] = useState(PHOTO_SORT_ORDERS.newest);
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
      sortPhotosForDisplay(
        photoLibrary.map((photo, index) => ({ photo, index })),
        photoSortOrder
      ).map(({ photo }) => ({
        ...photo,
        localizedAlt: getLocalizedText(photo.alt, currentLang),
      })),
    [currentLang, photoLibrary, photoSortOrder]
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

  const isWideRoute = route === ROUTES.photography || route === ROUTES.wheels;

  return (
    <div className={`page-shell ${isWideRoute ? 'page-shell--wide' : ''}`}>
      <main
        className={`container ${isWideRoute ? 'container--wide' : 'container--profile'}`}
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
            <a
              className={`site-nav-link ${route === ROUTES.wheels ? 'is-active' : ''}`}
              href={getRouteHref(ROUTES.wheels)}
              aria-current={route === ROUTES.wheels ? 'page' : undefined}
            >
              {t('navWheels')}
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
            onSortOrderChange={setPhotoSortOrder}
            photos={photos}
            sortOrder={photoSortOrder}
            t={t}
          />
        ) : route === ROUTES.wheels ? (
          <WheelsView t={t} />
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

function getStoredWheelsPassword() {
  try {
    return window.sessionStorage.getItem(WHEELS_PASSWORD_STORAGE_KEY) || '';
  } catch (error) {
    return '';
  }
}

function normalizeWheelsPayload(payload) {
  const payloadWheels = Array.isArray(payload?.wheels) ? payload.wheels : [];

  return WHEEL_TYPES.map((wheelType) => {
    const wheel = payloadWheels.find((candidate) => candidate?.id === wheelType.id);
    const items = Array.isArray(wheel?.items)
      ? wheel.items
          .map((item) => ({
            id: typeof item.id === 'string' ? item.id : '',
            label: typeof item.label === 'string' ? item.label : '',
          }))
          .filter((item) => item.id && item.label)
      : [];

    return {
      id: wheelType.id,
      items,
    };
  });
}

function getWheelGradient(items) {
  if (items.length === 0) {
    return 'linear-gradient(135deg, #f8fbff, #e7eef7)';
  }

  const colors = ['#3f658f', '#7c9a68', '#c48b57', '#8a6f9f', '#c96f78', '#547c88'];
  const segmentSize = 100 / items.length;

  return `conic-gradient(${items
    .map((item, index) => {
      const start = (index * segmentSize).toFixed(3);
      const end = ((index + 1) * segmentSize).toFixed(3);
      return `${colors[index % colors.length]} ${start}% ${end}%`;
    })
    .join(', ')})`;
}

function updateWheelCollection(wheels, updatedWheel) {
  return WHEEL_TYPES.map((wheelType) => {
    if (wheelType.id === updatedWheel.id) {
      return {
        id: updatedWheel.id,
        items: Array.isArray(updatedWheel.items) ? updatedWheel.items : [],
      };
    }

    return wheels.find((wheel) => wheel.id === wheelType.id) || { id: wheelType.id, items: [] };
  });
}

function WheelsView({ t }) {
  const [selectedWheelId, setSelectedWheelId] = useState(WHEEL_TYPES[0].id);
  const [wheels, setWheels] = useState(() => normalizeWheelsPayload({ wheels: [] }));
  const [password, setPassword] = useState(getStoredWheelsPassword);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const [spinState, setSpinState] = useState({
    rotation: 0,
    selectedItemId: null,
    resultLabel: '',
  });
  const spinTimerRef = useRef(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(WHEELS_PASSWORD_STORAGE_KEY, password);
    } catch (error) {
      // Session storage is a convenience only; editing still works without it.
    }
  }, [password]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadWheels() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetch(WHEELS_API_BASE, {
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`Failed to load wheels (${response.status})`);
        }

        const payload = await response.json();
        setWheels(normalizeWheelsPayload(payload));
      } catch (error) {
        if (error.name !== 'AbortError') {
          setErrorMessage(t('wheelsLoadError'));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadWheels();

    return () => controller.abort();
  }, [t]);

  useEffect(
    () => () => {
      if (spinTimerRef.current) {
        clearTimeout(spinTimerRef.current);
      }
    },
    []
  );

  const currentWheel = wheels.find((wheel) => wheel.id === selectedWheelId) || {
    id: selectedWheelId,
    items: [],
  };
  const currentWheelType = WHEEL_TYPES.find((wheelType) => wheelType.id === selectedWheelId);
  const wheelTitle = currentWheelType ? t(currentWheelType.labelKey) : selectedWheelId;
  const wheelItems = currentWheel.items;
  const wheelStyle = {
    '--wheel-rotation': `${spinState.rotation}deg`,
    background: getWheelGradient(wheelItems),
  };

  const sendWheelMutation = async (path, options = {}) => {
    if (!password.trim()) {
      setErrorMessage(t('wheelsPasswordRequired'));
      setStatusMessage('');
      return null;
    }

    setIsMutating(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const response = await fetch(`${WHEELS_API_BASE}/${selectedWheelId}${path}`, {
        method: options.method,
        headers: {
          'content-type': 'application/json',
          'x-wheels-admin-password': password,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || t('wheelsGenericError'));
      }

      if (payload.wheel) {
        setWheels((currentWheels) => updateWheelCollection(currentWheels, payload.wheel));
      }

      return payload;
    } catch (error) {
      setErrorMessage(error.message || t('wheelsGenericError'));
      return null;
    } finally {
      setIsMutating(false);
    }
  };

  const handleWheelSelect = (wheelId) => {
    if (spinTimerRef.current) {
      clearTimeout(spinTimerRef.current);
      spinTimerRef.current = null;
    }

    setSelectedWheelId(wheelId);
    setEditingItemId(null);
    setEditingLabel('');
    setStatusMessage('');
    setErrorMessage('');
    setIsWheelSpinning(false);
    setSpinState((current) => ({
      ...current,
      selectedItemId: null,
      resultLabel: '',
    }));
  };

  const handleAddItem = async (event) => {
    event.preventDefault();

    const payload = await sendWheelMutation('/items', {
      method: 'POST',
      body: { label: newItemLabel },
    });

    if (payload) {
      setNewItemLabel('');
      setStatusMessage(t('wheelsItemAdded'));
    }
  };

  const handleEditStart = (item) => {
    setEditingItemId(item.id);
    setEditingLabel(item.label);
    setStatusMessage('');
    setErrorMessage('');
  };

  const handleEditCancel = () => {
    setEditingItemId(null);
    setEditingLabel('');
  };

  const handleEditSubmit = async (event, itemId) => {
    event.preventDefault();

    const payload = await sendWheelMutation(`/items/${itemId}`, {
      method: 'PATCH',
      body: { label: editingLabel },
    });

    if (payload) {
      setEditingItemId(null);
      setEditingLabel('');
      setStatusMessage(t('wheelsItemUpdated'));
    }
  };

  const handleDeleteItem = async (itemId) => {
    const payload = await sendWheelMutation(`/items/${itemId}`, {
      method: 'DELETE',
    });

    if (payload) {
      setStatusMessage(t('wheelsItemDeleted'));
    }
  };

  const handleSpin = () => {
    if (wheelItems.length === 0 || isWheelSpinning) {
      return;
    }

    const selectedIndex = Math.floor(Math.random() * wheelItems.length);
    const selectedItem = wheelItems[selectedIndex];
    const segmentDegrees = 360 / wheelItems.length;
    const targetRotation = 360 - (selectedIndex * segmentDegrees + segmentDegrees / 2);
    const extraTurns = 1800 + Math.floor(Math.random() * 3) * 360;

    if (spinTimerRef.current) {
      clearTimeout(spinTimerRef.current);
    }

    setIsWheelSpinning(true);
    setSpinState((current) => ({
      rotation: current.rotation + extraTurns + targetRotation - (current.rotation % 360),
      selectedItemId: selectedItem.id,
      resultLabel: selectedItem.label,
    }));
    setStatusMessage('');
    setErrorMessage('');
    spinTimerRef.current = setTimeout(() => {
      setIsWheelSpinning(false);
      spinTimerRef.current = null;
    }, WHEEL_SPIN_ANIMATION_MS);
  };

  return (
    <div className="wheels-layout">
      <header className="wheels-hero">
        <p className="eyebrow">{t('wheelsEyebrow')}</p>
        <h1>{t('wheelsTitle')}</h1>
        <p className="subtitle">{t('wheelsSubtitle')}</p>
      </header>

      <section className="wheels-panel" aria-labelledby="wheels-section-title">
        <div className="wheels-section-heading">
          <div>
            <h2 id="wheels-section-title">{wheelTitle}</h2>
            <p className="wheels-count">
              {wheelItems.length} {t('wheelsItemCountLabel')}
            </p>
          </div>

          <div className="wheel-tabs" role="tablist" aria-label={t('wheelsTabsLabel')}>
            {WHEEL_TYPES.map((wheelType) => (
              <button
                key={wheelType.id}
                type="button"
                className={`wheel-tab ${selectedWheelId === wheelType.id ? 'is-active' : ''}`}
                role="tab"
                aria-selected={selectedWheelId === wheelType.id}
                onClick={() => handleWheelSelect(wheelType.id)}
              >
                {t(wheelType.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="wheels-workspace">
          <div className="wheel-stage" aria-live="polite">
            <div className={`wheel-pointer ${isWheelSpinning ? 'is-spinning' : ''}`} aria-hidden="true" />
            <div className={`wheel-dial ${isWheelSpinning ? 'is-spinning' : ''}`} style={wheelStyle}>
              {wheelItems.length === 0 ? (
                <span className="wheel-empty-label">{t('wheelsEmptyWheelLabel')}</span>
              ) : (
                wheelItems.map((item, index) => {
                  const segmentDegrees = 360 / wheelItems.length;
                  const angle = index * segmentDegrees + segmentDegrees / 2;

                  return (
                    <span
                      key={item.id}
                      className={`wheel-segment-label ${
                        spinState.selectedItemId === item.id ? 'is-selected' : ''
                      }`}
                      style={{
                        '--wheel-label-angle': `${angle - 90}deg`,
                        '--wheel-label-counter-angle': `${90 - angle}deg`,
                      }}
                    >
                      <span>{item.label}</span>
                    </span>
                  );
                })
              )}
            </div>
            <button
              type="button"
              className="wheel-spin-button"
              onClick={handleSpin}
              disabled={wheelItems.length === 0 || isWheelSpinning}
            >
              {t('wheelsSpinButton')}
            </button>
            <p className="wheel-result">
              {spinState.resultLabel
                ? t('wheelsResultLabel', { item: spinState.resultLabel })
                : t('wheelsResultPlaceholder')}
            </p>
          </div>

          <div className="wheels-editor">
            <label className="wheel-field">
              <span>{t('wheelsPasswordLabel')}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('wheelsPasswordPlaceholder')}
                autoComplete="current-password"
              />
            </label>

            <form className="wheel-add-form" onSubmit={handleAddItem}>
              <label className="wheel-field">
                <span>{t('wheelsAddLabel')}</span>
                <input
                  type="text"
                  value={newItemLabel}
                  onChange={(event) => setNewItemLabel(event.target.value)}
                  placeholder={t('wheelsAddPlaceholder')}
                  maxLength="80"
                />
              </label>
              <button type="submit" className="wheel-primary-button" disabled={isMutating}>
                {t('wheelsAddButton')}
              </button>
            </form>

            {errorMessage ? (
              <p className="wheel-message wheel-message--error" role="alert">
                {errorMessage}
              </p>
            ) : null}
            {statusMessage ? (
              <p className="wheel-message" role="status">
                {statusMessage}
              </p>
            ) : null}

            <div className="wheel-items" aria-label={t('wheelsItemsLabel')}>
              {isLoading ? (
                <p className="wheel-empty-state">{t('wheelsLoadingLabel')}</p>
              ) : wheelItems.length === 0 ? (
                <p className="wheel-empty-state">{t('wheelsEmptyBody')}</p>
              ) : (
                wheelItems.map((item) => (
                  <article key={item.id} className="wheel-item">
                    {editingItemId === item.id ? (
                      <form className="wheel-edit-form" onSubmit={(event) => handleEditSubmit(event, item.id)}>
                        <input
                          type="text"
                          value={editingLabel}
                          onChange={(event) => setEditingLabel(event.target.value)}
                          maxLength="80"
                          aria-label={t('wheelsEditInputLabel')}
                        />
                        <button type="submit" className="wheel-small-button" disabled={isMutating}>
                          {t('wheelsSaveButton')}
                        </button>
                        <button
                          type="button"
                          className="wheel-small-button wheel-small-button--quiet"
                          onClick={handleEditCancel}
                        >
                          {t('wheelsCancelButton')}
                        </button>
                      </form>
                    ) : (
                      <>
                        <span className="wheel-item-label">{item.label}</span>
                        <div className="wheel-item-actions">
                          <button
                            type="button"
                            className="wheel-small-button"
                            onClick={() => handleEditStart(item)}
                          >
                            {t('wheelsEditButton')}
                          </button>
                          <button
                            type="button"
                            className="wheel-small-button wheel-small-button--danger"
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={isMutating}
                          >
                            {t('wheelsDeleteButton')}
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PhotographyView({
  getAssetPath,
  isPhotosLoading,
  onPhotoSelect,
  onSortOrderChange,
  photos,
  sortOrder,
  t,
}) {
  const [galleryRef, galleryMetrics] = usePhotographyGalleryMetrics(!isPhotosLoading && photos.length > 0);
  const photoRows = useMemo(
    () =>
      buildJustifiedRows(
        photos,
        galleryMetrics.width,
        galleryMetrics.gap,
        getTargetRowHeight(galleryMetrics.width)
      ),
    [galleryMetrics.gap, galleryMetrics.width, photos]
  );

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
            <div className="photography-gallery-meta">
              <p className="photography-count">
                {photos.length} {t('photographyCountLabel')}
              </p>
              <div className="photo-sort-controls" role="group" aria-label={t('photoSortLabel')}>
                <button
                  type="button"
                  className={`photo-sort-button ${
                    sortOrder === PHOTO_SORT_ORDERS.newest ? 'is-active' : ''
                  }`}
                  aria-pressed={sortOrder === PHOTO_SORT_ORDERS.newest}
                  onClick={() => onSortOrderChange(PHOTO_SORT_ORDERS.newest)}
                >
                  {t('photoSortNewest')}
                </button>
                <button
                  type="button"
                  className={`photo-sort-button ${
                    sortOrder === PHOTO_SORT_ORDERS.oldest ? 'is-active' : ''
                  }`}
                  aria-pressed={sortOrder === PHOTO_SORT_ORDERS.oldest}
                  onClick={() => onSortOrderChange(PHOTO_SORT_ORDERS.oldest)}
                >
                  {t('photoSortOldest')}
                </button>
              </div>
            </div>
          </div>

          <div className="photography-grid" aria-label={t('photographyGridLabel')} ref={galleryRef}>
            {photoRows.map((row, rowIndex) => (
              <div
                key={`${row.items[0].photo.id}-${row.items[row.items.length - 1].photo.id}-${rowIndex}`}
                className={`photography-row ${row.isLastRow ? 'photography-row--last' : ''}`}
              >
                {row.items.map((item) => (
                  <button
                    key={item.photo.id}
                    type="button"
                    className="photo-tile"
                    onClick={() => onPhotoSelect(item.originalIndex)}
                    aria-label={t('photoOpenLabel', { index: item.originalIndex + 1 })}
                    style={{
                      width: `${item.width}px`,
                      height: `${item.height}px`,
                      flexBasis: `${item.width}px`,
                    }}
                  >
                    <img
                      src={getAssetPath(item.photo.thumbSrc)}
                      alt={item.photo.localizedAlt}
                      width={item.photo.width}
                      height={item.photo.height}
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ))}
              </div>
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
