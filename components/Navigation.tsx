import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import {
  Activity,
  ArrowDownAZ,
  ArrowRight,
  ArrowUpRight,
  Blocks,
  BookOpen,
  Check,
  ChevronDown,
  Code2,
  Compass,
  Folder,
  Globe2,
  Grid2X2,
  History,
  Languages,
  LayoutList,
  Menu,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  SearchX,
  Settings2,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { Category, ClientConnectivityMap, Website } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import SiteCard from './SiteCard';

interface Props {
  websites: Website[];
  categories: Category[];
  connectivity: ClientConnectivityMap;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onManage: () => void;
  onRefresh: () => void;
  onRefreshOne: (id: string) => void;
}
type Collection = 'all' | 'favorites' | 'recent';
const PREFERENCES_KEY = 'sentinel_nav_workspace_v1';
const categoryIcons = [Code2, Sparkles, BookOpen, Blocks, Globe2, Folder];

export default function Navigation({
  websites,
  categories,
  connectivity,
  loading,
  error,
  onRetry,
  onManage,
  onRefresh,
  onRefreshOne,
}: Props) {
  const { t, language, setLanguage } = useTranslation();
  const zh = language === 'zh';
  const copy = (cn: string, en: string) => (zh ? cn : en);
  const [collection, setCollection] = useState<Collection>('all');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState('default');
  const [status, setStatus] = useState('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}');
      const ids = (value: unknown): string[] =>
        Array.isArray(value)
          ? value.filter((id): id is string => typeof id === 'string')
          : [];
      // Browser-only preferences are loaded after hydration.
      /* eslint-disable react-hooks/set-state-in-effect */
      setFavorites(ids(saved.favorites));
      setRecent(ids(saved.recent).slice(0, 12));
      if (saved.layout === 'list') setLayout('list');
      setSidebarCollapsed(saved.sidebarCollapsed === true);
    } catch {
      /* Missing or invalid preferences fall back to defaults. */
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        PREFERENCES_KEY,
        JSON.stringify({ favorites, recent, layout, sidebarCollapsed }),
      );
    } catch {
      // Surface persistence failures so users know their preferences are session-only.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStorageError(true);
    }
  }, [favorites, recent, layout, sidebarCollapsed, ready]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing =
        target.matches('input, textarea, select') || target.isContentEditable;
      if (
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') ||
        (event.key === '/' && !editing)
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setMenuOpen(false);
        if (document.activeElement === searchRef.current) {
          setQuery('');
          searchRef.current?.blur();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const menuButton = menuButtonRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebarRef.current?.querySelector('button')?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const buttons =
        sidebarRef.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', trapFocus);
      menuButton?.focus();
    };
  }, [menuOpen]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 801px)');
    const closeMobileMenu = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener('change', closeMobileMenu);
    return () => desktop.removeEventListener('change', closeMobileMenu);
  }, []);

  const chooseCollection = (value: Collection) => {
    setCollection(value);
    setCategory('all');
    setMenuOpen(false);
  };
  const chooseCategory = (value: string) => {
    setCategory(value);
    setCollection('all');
    setMenuOpen(false);
  };
  const toggleFavorite = (id: string) =>
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  const recordVisit = (id: string) =>
    setRecent((prev) =>
      [id, ...prev.filter((item) => item !== id)].slice(0, 12),
    );
  const categoryName = (cat: Category) =>
    cat.id === 'default' ? copy('常用网站', 'General') : cat.name;
  const statusCounts = { online: 0, offline: 0, unknown: 0, checking: 0 };
  websites.forEach((site) => {
    statusCounts[connectivity[site.id]?.status || 'unknown'] += 1;
  });
  const favoriteCount = websites.filter((site) =>
    favorites.includes(site.id),
  ).length;
  const refreshing = websites.some(
    (site) => connectivity[site.id]?.status === 'checking',
  );
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filtered = websites
    .filter((site) => {
      const cat = categories.find((item) => item.id === site.categoryId);
      const text =
        `${site.title} ${site.url} ${site.description || ''} ${cat ? categoryName(cat) : ''}`.toLocaleLowerCase();
      return (
        (category === 'all' || site.categoryId === category) &&
        (collection === 'all' ||
          (collection === 'favorites'
            ? favorites.includes(site.id)
            : recent.includes(site.id))) &&
        (status === 'all' ||
          (connectivity[site.id]?.status || 'unknown') === status) &&
        terms.every((term) => text.includes(term))
      );
    })
    .sort((a, b) =>
      sort === 'name'
        ? a.title.localeCompare(b.title, zh ? 'zh-CN' : 'en')
        : collection === 'recent'
          ? recent.indexOf(a.id) - recent.indexOf(b.id)
          : 0,
    );
  const title =
    collection === 'favorites'
      ? copy('我的收藏', 'Favorites')
      : collection === 'recent'
        ? copy('最近访问', 'Recently visited')
        : category === 'all'
          ? copy('探索所有网站', 'Explore your websites')
          : categoryName(
              categories.find((cat) => cat.id === category) || {
                id: category,
                name: category,
              },
            );
  const hasFilters = !!query || category !== 'all' || status !== 'all';
  const reset = () => {
    setQuery('');
    setCategory('all');
    setStatus('all');
  };
  const recentSites = recent
    .map((id) => websites.find((site) => site.id === id))
    .filter((site): site is Website => !!site)
    .slice(0, 4);

  return (
    <div className={`navigator ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Head>
        <title>
          {copy(
            '发现好网站，开启新灵感',
            'A little direction. A lot to discover.',
          )}{' '}
          · {t('appName')}
        </title>
        <meta
          name="description"
          content={copy(
            '一个有序、好用的个人导航空间。搜索、收藏与发现，让每一次出发都更轻松。',
            'Your personal starting point. Find, organize and revisit your favorite places on the web.',
          )}
        />
      </Head>
      <a href="#nav-content" className="skip-link">
        {copy('跳到主要内容', 'Skip to content')}
      </a>
      {menuOpen && (
        <button
          className="sidebar-overlay"
          aria-label={copy('关闭导航', 'Close navigation')}
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        id="workspace-sidebar"
        className={`workspace-sidebar ${menuOpen ? 'is-open' : ''}`}
        aria-label={copy('网站导航', 'Website navigation')}
      >
        <button
          className="workspace-brand"
          aria-label={t('appName')}
          title={t('appName')}
          onClick={() => {
            chooseCollection('all');
            reset();
          }}
        >
          <span className="brand-symbol">
            <Compass size={23} />
          </span>
          <span className="brand-name">
            {t('appName')}
            <small>YOUR DIGITAL COMPASS</small>
          </span>
        </button>
        <div className="sidebar-section-label">
          WORKSPACE <span>01</span>
        </div>
        <nav className="sidebar-nav" aria-label={copy('个人空间', 'Workspace')}>
          <button
            className={
              collection === 'all' && category === 'all' ? 'active' : ''
            }
            onClick={() => chooseCollection('all')}
            aria-label={copy('发现网站', 'Discover')}
            title={copy('发现网站', 'Discover')}
            aria-current={
              collection === 'all' && category === 'all' ? 'page' : undefined
            }
          >
            <Grid2X2 size={18} />
            <span>{copy('发现网站', 'Discover')}</span>
            <small>{websites.length}</small>
          </button>
          <button
            className={collection === 'favorites' ? 'active' : ''}
            onClick={() => chooseCollection('favorites')}
            aria-label={copy('我的收藏', 'Favorites')}
            title={copy('我的收藏', 'Favorites')}
            aria-current={collection === 'favorites' ? 'page' : undefined}
          >
            <Star size={18} />
            <span>{copy('我的收藏', 'Favorites')}</span>
            <small>{favoriteCount}</small>
          </button>
          <button
            className={collection === 'recent' ? 'active' : ''}
            onClick={() => chooseCollection('recent')}
            aria-label={copy('最近访问', 'Recent')}
            title={copy('最近访问', 'Recent')}
            aria-current={collection === 'recent' ? 'page' : undefined}
          >
            <History size={18} />
            <span>{copy('最近访问', 'Recent')}</span>
          </button>
        </nav>
        <div className="sidebar-section-label">
          {copy('网站分类', 'COLLECTIONS')}{' '}
          <span>{String(categories.length).padStart(2, '0')}</span>
        </div>
        <nav
          className="sidebar-nav category-navigation"
          aria-label={copy('网站分类', 'Categories')}
        >
          {categories.map((cat, index) => {
            const Icon = categoryIcons[index % categoryIcons.length];
            return (
              <button
                key={cat.id}
                className={category === cat.id ? 'active' : ''}
                onClick={() => chooseCategory(cat.id)}
                aria-label={categoryName(cat)}
                title={categoryName(cat)}
                aria-current={category === cat.id ? 'page' : undefined}
              >
                <Icon size={18} />
                <span>{categoryName(cat)}</span>
                <small>
                  {websites.filter((site) => site.categoryId === cat.id).length}
                </small>
              </button>
            );
          })}
          {!categories.length && (
            <p className="sidebar-placeholder">
              {copy(
                '你的分类，即将在这里展开',
                'Your collections will live here.',
              )}
            </p>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-mark">✳</span>
            <p>
              {copy('让好网站，', 'Good places.')}
              <br />
              {copy('都有一个好位置。', 'All in one place.')}
            </p>
            <span>
              {copy(
                '少一点寻找，多一点创造。',
                'Less searching. More creating.',
              )}
            </span>
          </div>
          <button
            className="manage-button"
            onClick={onManage}
            aria-label={copy('管理工作台', 'Manage workspace')}
            title={copy('管理工作台', 'Manage workspace')}
          >
            <Settings2 size={17} />
            <span>{copy('管理工作台', 'Manage workspace')}</span>
            <ArrowUpRight size={15} />
          </button>
          <p className="sidebar-version">
            CURATED BY YOU <span>↗</span>
          </p>
        </div>
      </aside>

      <div className="workspace-body" inert={menuOpen || undefined}>
        <header className="workspace-topbar">
          <div className="breadcrumb">
            <button
              className="desktop-sidebar-toggle quiet-button"
              onClick={() => setSidebarCollapsed((value) => !value)}
              aria-label={
                sidebarCollapsed
                  ? copy('展开侧栏', 'Expand sidebar')
                  : copy('折叠侧栏', 'Collapse sidebar')
              }
              title={
                sidebarCollapsed
                  ? copy('展开侧栏', 'Expand sidebar')
                  : copy('折叠侧栏', 'Collapse sidebar')
              }
              aria-expanded={!sidebarCollapsed}
              aria-controls="workspace-sidebar"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )}
            </button>
            <button
              ref={menuButtonRef}
              className="mobile-menu quiet-button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={copy('展开导航', 'Open navigation')}
              aria-expanded={menuOpen}
              aria-controls="workspace-sidebar"
            >
              <Menu size={20} />
            </button>
            <span>{copy('我的工作空间', 'My workspace')}</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{copy('导航', 'Navigation')}</strong>
          </div>
          <div className="topbar-actions">
            <span className="workspace-tag">
              <span />
              {copy('保持好奇，持续探索', 'STAY CURIOUS')}
            </span>
            <button
              className="quiet-button language-button"
              onClick={() => setLanguage(zh ? 'en' : 'zh')}
              aria-label={zh ? 'Switch to English' : '切换到中文'}
            >
              <Languages size={17} />
              <span>{zh ? 'EN' : '中文'}</span>
            </button>
            <button
              className="workspace-avatar"
              onClick={onManage}
              aria-label={copy('管理员入口', 'Administrator login')}
            >
              V<span />
            </button>
          </div>
        </header>
        <main id="nav-content" className="workspace-content" tabIndex={-1}>
          <section
            className="network-panel"
            aria-label={copy('连通性概览', 'Connectivity overview')}
          >
            <div className="network-header">
              <button
                className="network-toggle"
                onClick={() => setShowStatus(!showStatus)}
                aria-expanded={showStatus}
                aria-controls="network-details"
              >
                <Activity size={18} />
                <span>{copy('连通性概览', 'Connectivity overview')}</span>
                <ChevronDown
                  size={15}
                  className={showStatus ? 'rotate-180' : ''}
                />
              </button>
              <div
                className="network-summary"
                aria-label={copy(
                  '当前浏览器检测结果',
                  'Current browser probe results',
                )}
              >
                {(['online', 'offline', 'unknown', 'checking'] as const).map(
                  (value) => (
                    <button
                      key={value}
                      className={`network-stat status-dot-${value} ${status === value ? 'is-selected' : ''}`}
                      onClick={() =>
                        setStatus((current) =>
                          current === value ? 'all' : value,
                        )
                      }
                      aria-pressed={status === value}
                      disabled={loading || error || websites.length === 0}
                      title={copy('筛选', 'Filter')}
                    >
                      <span className="traffic-light" aria-hidden="true" />
                      <span>{t(`status.${value}`)}</span>
                      <strong>
                        {loading || error ? '—' : statusCounts[value]}
                      </strong>
                    </button>
                  ),
                )}
              </div>
              <button
                className="network-refresh"
                onClick={onRefresh}
                disabled={
                  refreshing || loading || error || websites.length === 0
                }
                title={t('dashboard.refreshAll')}
                aria-label={t('dashboard.refreshAll')}
              >
                <RefreshCw
                  size={15}
                  className={refreshing ? 'animate-spin' : ''}
                />
                <span>
                  {refreshing
                    ? copy('检测中', 'Checking')
                    : copy('重新检测', 'Check all')}
                </span>
              </button>
            </div>
            {showStatus && (
              <div id="network-details" className="network-details">
                <p>{t('dashboard.clientProbeNotice')}</p>
                <div>
                  <label>
                    {copy('显示状态', 'Show status')}
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="all">
                        {copy('全部状态', 'All statuses')}
                      </option>
                      {['online', 'offline', 'unknown', 'checking'].map(
                        (value) => (
                          <option key={value} value={value}>
                            {t(`status.${value}`)}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>
              </div>
            )}
          </section>

          <section
            className="search-section"
            aria-label={copy('搜索网站', 'Search websites')}
          >
            <div className="workspace-search">
              <Search size={21} />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                type="search"
                aria-label={copy(
                  '搜索网站、描述或分类',
                  'Search websites, descriptions or categories',
                )}
                placeholder={copy(
                  '搜索网站、灵感，或下一个目的地…',
                  'Search a website, an idea, your next destination…',
                )}
              />
              {query ? (
                <button
                  onClick={() => {
                    setQuery('');
                    searchRef.current?.focus();
                  }}
                  className="quiet-button"
                  aria-label={copy('清空搜索', 'Clear search')}
                >
                  <X size={18} />
                </button>
              ) : (
                <kbd>⌘ / Ctrl K</kbd>
              )}
            </div>
            <div className="search-meta">
              <span>
                {copy(
                  '你的互联网，井然有序',
                  'A little order for your internet',
                )}
                <span className="meta-dot">·</span>
                {websites.length} {copy('个网站', 'websites')}
                <span className="meta-dot">·</span>
                {categories.length} {copy('个分类', 'collections')}
              </span>
              <span className="search-shortcut">
                {copy('也可以按', 'Or press')} <kbd>/</kbd>{' '}
                {copy('开始搜索', 'to search')}
              </span>
            </div>
          </section>

          {recentSites.length > 0 &&
            collection !== 'recent' &&
            !query &&
            category === 'all' && (
              <section
                className="recent-strip"
                aria-label={copy('最近访问', 'Recently visited')}
              >
                <span>
                  <History size={15} />
                  {copy('继续探索', 'Pick up where you left off')}
                </span>
                <div>
                  {recentSites.map((site) => (
                    <a
                      key={site.id}
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => recordVisit(site.id)}
                    >
                      {site.title}
                      <ArrowUpRight size={12} />
                    </a>
                  ))}
                </div>
              </section>
            )}

          <section
            id="website-library"
            className="website-library"
            aria-label={title}
          >
            <div className="library-heading">
              <div>
                <div className="section-kicker">YOUR HANDPICKED INTERNET</div>
                <h1>
                  {title}
                  <span>{filtered.length.toString().padStart(2, '0')}</span>
                </h1>
              </div>
              <button className="add-site-button" onClick={onManage}>
                <Plus size={16} />
                <span>{copy('添加网站', 'Add website')}</span>
              </button>
            </div>
            <div className="library-toolbar">
              <div
                className="category-tabs"
                aria-label={copy('筛选分类', 'Filter categories')}
              >
                <button
                  onClick={() => setCategory('all')}
                  className={category === 'all' ? 'selected' : ''}
                  aria-pressed={category === 'all'}
                >
                  {copy('全部网站', 'All websites')}
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={category === cat.id ? 'selected' : ''}
                    aria-pressed={category === cat.id}
                  >
                    {categoryName(cat)}
                  </button>
                ))}
              </div>
              <div className="view-controls">
                <label className="sort-control">
                  <ArrowDownAZ size={16} />
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    aria-label={copy('网站排序', 'Sort websites')}
                  >
                    <option value="default">
                      {copy('默认排序', 'Default order')}
                    </option>
                    <option value="name">{copy('名称排序', 'Name A–Z')}</option>
                  </select>
                </label>
                <span className="control-divider" />
                <button
                  className={layout === 'grid' ? 'selected' : ''}
                  onClick={() => setLayout('grid')}
                  aria-label={copy('网格视图', 'Grid view')}
                  aria-pressed={layout === 'grid'}
                >
                  <Grid2X2 size={17} />
                </button>
                <button
                  className={layout === 'list' ? 'selected' : ''}
                  onClick={() => setLayout('list')}
                  aria-label={copy('列表视图', 'List view')}
                  aria-pressed={layout === 'list'}
                >
                  <LayoutList size={18} />
                </button>
              </div>
            </div>
            {storageError && (
              <p className="preference-notice" role="status">
                {copy(
                  '浏览器无法保存偏好，收藏和访问记录仅在本次会话有效。',
                  'Browser storage is unavailable. Favorites and history will last for this session.',
                )}
              </p>
            )}
            {(query || status !== 'all') && (
              <div className="filter-summary" role="status">
                <span>
                  {copy('找到', 'Found')} {filtered.length}{' '}
                  {copy('个网站', 'websites')}
                  {query && ` · “${query}”`}
                  {status !== 'all' && ` · ${t(`status.${status}`)}`}
                </span>
                <button onClick={reset}>
                  {copy('清除筛选', 'Clear filters')}
                  <X size={13} />
                </button>
              </div>
            )}
            {error ? (
              <div className="workspace-empty" role="alert">
                <Globe2 size={30} />
                <h2>
                  {copy('网站暂时没能加载', 'Could not load your websites')}
                </h2>
                <p>
                  {copy(
                    '请检查网络连接，然后重试。',
                    'Check your connection and try again.',
                  )}
                </p>
                <button onClick={onRetry}>
                  {copy('重新加载', 'Try again')}
                  <RefreshCw size={15} />
                </button>
              </div>
            ) : loading ? (
              <div
                className="website-grid"
                aria-busy="true"
                aria-label={copy('正在加载网站', 'Loading websites')}
              >
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="website-skeleton">
                    <span />
                    <span />
                    <span />
                  </div>
                ))}
              </div>
            ) : filtered.length > 0 ? (
              <div
                className={`website-grid ${layout === 'list' ? 'website-list' : ''}`}
              >
                {filtered.map((site) => (
                  <SiteCard
                    key={site.id}
                    site={site}
                    clientConnectivity={
                      connectivity[site.id] || {
                        status: 'unknown',
                        lastChecked: 0,
                      }
                    }
                    onRefreshOne={onRefreshOne}
                    categoryName={
                      categories.find((cat) => cat.id === site.categoryId)
                        ? categoryName(
                            categories.find(
                              (cat) => cat.id === site.categoryId,
                            )!,
                          )
                        : copy('未分类', 'Uncategorized')
                    }
                    favorite={favorites.includes(site.id)}
                    onToggleFavorite={toggleFavorite}
                    onVisit={recordVisit}
                  />
                ))}
              </div>
            ) : (
              <div className="workspace-empty">
                {hasFilters ? (
                  <SearchX size={30} />
                ) : collection === 'favorites' ? (
                  <Star size={30} />
                ) : collection === 'recent' ? (
                  <History size={30} />
                ) : (
                  <Compass size={32} />
                )}
                <h2>
                  {hasFilters
                    ? copy('换个关键词，继续发现', 'Try another direction')
                    : collection === 'favorites'
                      ? copy(
                          '把喜欢的网站，留在这里',
                          'Make room for your favorites',
                        )
                      : collection === 'recent'
                        ? copy(
                            '你的探索，从下一次点击开始',
                            'Your next click starts the story',
                          )
                        : copy(
                            '为你的互联网，选一个起点',
                            'Give your internet a starting point',
                          )}
                </h2>
                <p>
                  {hasFilters
                    ? copy(
                        '没有匹配的网站，试试更短的关键词或其他分类。',
                        'No matches. Try a shorter keyword or another category.',
                      )
                    : collection === 'favorites'
                      ? copy(
                          '点击网站卡片上的星标，建立自己的常用清单。',
                          'Star a website to keep it in your personal collection.',
                        )
                      : collection === 'recent'
                        ? copy(
                            '从这里打开的网站，会自动出现在最近访问中。',
                            'Websites opened here will appear in your recent history.',
                          )
                        : copy(
                            '添加你常用的工具、灵感来源和喜欢的网站。',
                            'Add the tools, inspiration and places you come back to.',
                          )}
                </p>
                <button
                  onClick={
                    hasFilters
                      ? reset
                      : collection !== 'all'
                        ? () => chooseCollection('all')
                        : onManage
                  }
                >
                  {hasFilters
                    ? copy('清除筛选', 'Clear filters')
                    : collection !== 'all'
                      ? copy('发现网站', 'Discover websites')
                      : copy('添加第一个网站', 'Add your first website')}
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
          </section>

          <footer className="workspace-footer">
            <span>
              <Compass size={14} />
              {t('appName')}
              <span className="footer-divider">/</span>
              {copy(
                '你的每一次出发，都值得期待。',
                'Every great discovery starts somewhere.',
              )}
            </span>
            <span>
              <Check size={12} />
              {copy(
                '收藏与访问记录保存在此浏览器',
                'Favorites & history stay in this browser',
              )}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
