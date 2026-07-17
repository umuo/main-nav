import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Braces,
  CheckCircle2,
  Globe2,
  Languages,
  Laptop2,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  RefreshCcw,
  Search,
  SearchX,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Website, ViewState, Category, ClientConnectivity, ClientConnectivityMap, MonitorRunSummary } from '../types';
import { CHECK_INTERVAL_MS } from '../constants';
import { useTranslation } from '../contexts/LanguageContext';
import { probeWebsiteFromBrowser } from '../services/monitorService';

import SiteCard from '../components/SiteCard';
import AdminDashboard from '../components/AdminDashboard';
import Captcha from '../components/Captcha';

const CLIENT_CONNECTIVITY_STORAGE_KEY = 'sentinel_nav_client_connectivity_v1';
const CLIENT_PROBE_CONCURRENCY = 4;

const emptyClientConnectivity = (): ClientConnectivity => ({
  status: 'unknown',
  lastChecked: 0,
});

const loadCachedClientConnectivity = (sites: Website[]): ClientConnectivityMap => {
  if (typeof window === 'undefined') return {};

  try {
    const parsed = JSON.parse(localStorage.getItem(CLIENT_CONNECTIVITY_STORAGE_KEY) || '{}') as ClientConnectivityMap;
    const allowedStatuses = new Set(['online', 'offline', 'checking', 'unknown']);

    return Object.fromEntries(
      sites.flatMap(site => {
        const value = parsed[site.id];
        if (!value || !allowedStatuses.has(value.status) || typeof value.lastChecked !== 'number') return [];
        return [[site.id, value]];
      })
    );
  } catch {
    return {};
  }
};

export default function Home() {
  const { t, language, setLanguage } = useTranslation();
  const [view, setView] = useState<ViewState>('dashboard');
  const [websites, setWebsites] = useState<Website[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const websitesRef = useRef<Website[]>([]);
  const [clientConnectivity, setClientConnectivity] = useState<ClientConnectivityMap>({});
  const clientConnectivityLoadedRef = useRef(false);
  const clientProbeSequenceRef = useRef<Record<string, number>>({});
  const initialHydrationStartedRef = useRef(false);

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    websitesRef.current = websites;
  }, [websites]);

  useEffect(() => {
    if (!clientConnectivityLoadedRef.current) return;
    localStorage.setItem(CLIENT_CONNECTIVITY_STORAGE_KEY, JSON.stringify(clientConnectivity));
  }, [clientConnectivity]);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        setIsAdminAuthenticated(true);
        setView('admin');
      } else {
        setIsAdminAuthenticated(false);
      }
    } catch {
      setIsAdminAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    // Session state is loaded from the server once the client has mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkSession();
  }, [checkSession]);

  const addCategory = async (name: string) => {
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        const newCat = await res.json();
        setCategories([...categories, newCat]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateCategory = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        setCategories(categories.map(c => c.id === id ? { ...c, name } : c));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories(categories.filter(c => c.id !== id));
        // Refresh sites as they might have been reassigned
        fetchWebsites();
      } else {
        alert("Could not delete category (maybe it's the last one?)");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const checkServerSite = useCallback(async (id: string, currentList = websitesRef.current) => {
    const previousSite = currentList.find(site => site.id === id);
    if (!previousSite) return;
    setWebsites(prev => {
      const next = prev.map(site => site.id === id ? { ...site, status: 'checking' as const } : site);
      websitesRef.current = next;
      return next;
    });

    try {
      const res = await fetch('/api/monitor/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const result = await res.json();
      if (!res.ok && res.status !== 422) throw new Error('Website check failed');
      setWebsites(prev => {
        const next = prev.map(site => site.id === id ? {
          ...site,
          status: result.status,
          lastChecked: result.lastChecked,
          latency: result.latency,
          serverStatusCode: result.statusCode || undefined,
          serverReason: result.reason
        } : site);
        websitesRef.current = next;
        return next;
      });
    } catch {
      setWebsites(prev => {
        const next = prev.map(site => site.id === id ? previousSite : site);
        websitesRef.current = next;
        return next;
      });
    }
  }, []);

  const checkClientSite = useCallback(async (
    id: string,
    currentList = websitesRef.current,
    allowPermissionPrompt = false
  ) => {
    const site = currentList.find(candidate => candidate.id === id);
    if (!site) return;

    const sequence = (clientProbeSequenceRef.current[id] || 0) + 1;
    clientProbeSequenceRef.current[id] = sequence;

    setClientConnectivity(prev => {
      const previous = prev[id] || emptyClientConnectivity();
      const next = { ...prev, [id]: { ...previous, status: 'checking' as const } };
      return next;
    });

    const result = await probeWebsiteFromBrowser(site.url, { allowPermissionPrompt });
    if (clientProbeSequenceRef.current[id] !== sequence) return;

    setClientConnectivity(prev => {
      const next = { ...prev, [id]: result };
      return next;
    });
  }, []);

  const checkAllClientSites = useCallback(async (
    currentList = websitesRef.current,
    allowPermissionPrompt = false
  ) => {
    for (let index = 0; index < currentList.length; index += CLIENT_PROBE_CONCURRENCY) {
      const batch = currentList.slice(index, index + CLIENT_PROBE_CONCURRENCY);
      await Promise.all(batch.map(site => checkClientSite(site.id, currentList, allowPermissionPrompt)));
    }
  }, [checkClientSite]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories', error);
    }
  }, []);

  const fetchWebsites = useCallback(async () => {
    try {
      const res = await fetch('/api/sites');
      if (res.ok) {
        const data = await res.json();
        websitesRef.current = data;
        setWebsites(data);

        const cachedConnectivity = loadCachedClientConnectivity(data);
        clientConnectivityLoadedRef.current = true;
        setClientConnectivity(cachedConnectivity);

        const now = Date.now();
        const staleOrMissingSites = data.filter((site: Website) => {
          const cached = cachedConnectivity[site.id];
          return !cached || cached.status === 'checking' || now - cached.lastChecked >= CHECK_INTERVAL_MS;
        });
        if (staleOrMissingSites.length > 0) {
          void checkAllClientSites(staleOrMissingSites);
        }

      }
    } catch (error) {
      console.error('Failed to fetch websites', error);
    }
  }, [checkAllClientSites]);

  const runServerChecks = useCallback(async (): Promise<MonitorRunSummary> => {
    const res = await fetch('/api/monitor/run', { method: 'POST' });
    const result = await res.json().catch(() => null) as MonitorRunSummary | null;
    if (!res.ok || !result) {
      throw new Error('Server checks failed');
    }

    await fetchWebsites();
    return result;
  }, [fetchWebsites]);

  useEffect(() => {
    if (initialHydrationStartedRef.current) return;
    initialHydrationStartedRef.current = true;
    // Initial API hydration intentionally populates the client-side dashboard state.
    void fetchWebsites();
    void fetchCategories();
  }, [fetchCategories, fetchWebsites]);

  useEffect(() => {
    const interval = setInterval(() => void checkAllClientSites(websitesRef.current), CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkAllClientSites]);

  const handleCaptchaValidate = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) {
      setLoginError(t('login.errorCaptcha'));
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
          turnstileToken,
        })
      });

      if (res.ok) {
        setIsAdminAuthenticated(true);
        setLoginError('');
        setLoginUsername('');
        setLoginPassword('');
        setView('admin');
      } else {
        const errorBody = await res.json().catch(() => null) as { error?: string; retryAfter?: number } | null;
        if (res.status === 400 && errorBody?.error === 'Invalid human verification') {
          setLoginError(t('login.errorCaptcha'));
        } else if (res.status === 429) {
          setLoginError(t('login.errorRateLimit', { seconds: errorBody?.retryAfter || 60 }));
        } else if (res.status === 503 && errorBody?.error === 'Human verification unavailable') {
          setLoginError(t('login.errorCaptchaService'));
        } else if (res.status === 503) {
          setLoginError(t('login.errorService'));
        } else if (res.status === 500 && errorBody?.error === 'Authentication is not configured') {
          setLoginError(t('login.errorConfig'));
        } else {
          setLoginError(t('login.errorAuth'));
        }
        setTurnstileToken('');
        setCaptchaRefreshKey(key => key + 1);
      }
    } catch {
      setLoginError(t('login.errorNetwork'));
      setTurnstileToken('');
      setCaptchaRefreshKey(key => key + 1);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsAdminAuthenticated(false);
    setView('dashboard');
  };

  const checkAdminAccess = () => {
    if (isAdminAuthenticated) {
      setView('admin');
    } else {
      setView('login');
    }
  };

  const addWebsite = async (data: Omit<Website, 'id' | 'status' | 'lastChecked'>) => {
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        const newSite = await res.json() as Website;
        const nextWebsites = [...websitesRef.current, newSite];
        websitesRef.current = nextWebsites;
        setWebsites(nextWebsites);
        void checkClientSite(newSite.id, nextWebsites, true);
        void checkServerSite(newSite.id, nextWebsites);
      }
    } catch {
      alert(t('admin.errorAdd'));
    }
  };

  const editWebsite = async (updatedSite: Website) => {
    try {
      const res = await fetch(`/api/sites/${updatedSite.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: updatedSite.title,
          url: updatedSite.url,
          description: updatedSite.description,
          iconUrl: updatedSite.iconUrl,
          categoryId: updatedSite.categoryId
        })
      });

      if (res.ok) {
        const nextWebsites = websitesRef.current.map(w => w.id === updatedSite.id ? updatedSite : w);
        websitesRef.current = nextWebsites;
        setWebsites(nextWebsites);
        void checkClientSite(updatedSite.id, nextWebsites, true);
        void checkServerSite(updatedSite.id, nextWebsites);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteWebsite = async (id: string) => {
    if (window.confirm(t('admin.confirmDelete'))) {
      try {
        const res = await fetch(`/api/sites/${id}`, { method: 'DELETE' });
        if (res.ok) {
          const nextWebsites = websitesRef.current.filter(w => w.id !== id);
          websitesRef.current = nextWebsites;
          setWebsites(nextWebsites);
          setClientConnectivity(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          delete clientProbeSequenceRef.current[id];
        }
      } catch {
        alert('Failed to delete');
      }
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  const getClientConnectivity = (site: Website) => clientConnectivity[site.id] || emptyClientConnectivity();
  const onlineCount = websites.filter(site => getClientConnectivity(site).status === 'online').length;
  const attentionCount = websites.filter(site => {
    const status = getClientConnectivity(site).status;
    return status === 'offline' || status === 'unknown';
  }).length;
  const availability = websites.length === 0 ? 100 : Math.round((onlineCount / websites.length) * 100);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredWebsites = websites.filter(site => {
    const inCategory = selectedCategory === 'all' || site.categoryId === selectedCategory;
    const matchesSearch = normalizedSearch.length === 0 ||
      site.title.toLowerCase().includes(normalizedSearch) ||
      site.url.toLowerCase().includes(normalizedSearch) ||
      site.description?.toLowerCase().includes(normalizedSearch);
    return inCategory && matchesSearch;
  });
  const isRefreshing = websites.some(site => getClientConnectivity(site).status === 'checking');

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <div className="ambient-orb ambient-orb-left" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-right" aria-hidden="true" />

      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="nav-shell mx-auto flex h-[4.25rem] max-w-[1400px] items-center justify-between rounded-2xl px-3.5 sm:px-5">
          <button
            type="button"
            onClick={() => setView('dashboard')}
            className="group flex min-w-0 items-center gap-3 rounded-xl text-left"
            aria-label={t('dashboard.dashboardLink')}
          >
            <div className="primary-button flex h-10 w-10 flex-none items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-[1.04]">
              <Braces size={19} aria-hidden="true" />
            </div>
            <span className="min-w-0">
              <span className="brand-title block truncate text-[var(--text-primary)]">{t('appName')}</span>
              <span className="brand-subtitle hidden truncate sm:block">{t('dashboard.brandSubtitle')}</span>
            </span>
          </button>

          <nav className="flex items-center gap-1.5 sm:gap-2">
            {view === 'dashboard' && (
              <span className="mr-1 hidden sm:block">
                <span className={`status-badge ${attentionCount > 0 ? 'status-offline' : 'status-online'}`}>
                  {attentionCount > 0
                    ? t('dashboard.attentionSummary', { count: attentionCount })
                    : t('dashboard.operationalSummary')}
                </span>
              </span>
            )}

            <button
              onClick={toggleLanguage}
              className="icon-button flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold uppercase"
              title={language === 'en' ? '切换到中文' : 'Switch to English'}
            >
              <Languages size={15} />
              <span>{language}</span>
            </button>

            {view === 'dashboard' ? (
              <button
                onClick={checkAdminAccess}
                className="icon-button flex h-9 w-9 items-center justify-center rounded-xl"
                title={t('dashboard.adminLogin')}
              >
                <LockKeyhole size={15} />
              </button>
            ) : (
              <button
                onClick={() => setView('dashboard')}
                className="secondary-button flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold"
              >
                <LayoutDashboard size={16} />
                <span className="hidden sm:inline">{t('dashboard.dashboardLink')}</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-grow">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-6 sm:py-10 lg:px-8">

          {view === 'dashboard' && (
            <div className="animate-fade-in-up">
              <section className="hero-panel rounded-[1.75rem] p-5 sm:p-7 lg:p-8">
                <div className="relative z-10 flex flex-col justify-between gap-7 lg:flex-row lg:items-start">
                  <div className="max-w-2xl">
                    <span className="eyebrow">
                      <Sparkles size={14} aria-hidden="true" />
                      {t('dashboard.workspace')}
                    </span>
                    <h2 className="mt-4 text-3xl font-semibold tracking-[-0.045em] text-[var(--text-primary)] sm:text-4xl lg:text-[2.75rem]">
                      {t('dashboard.systemStatus')}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
                      {t('dashboard.monitoringDesc', { count: websites.length })}
                    </p>
                    <div className="mt-5 flex items-center gap-2.5 text-sm font-medium text-[var(--text-secondary)]">
                      <span className={`h-2.5 w-2.5 rounded-full ${attentionCount > 0 ? 'bg-[#f04438]' : 'bg-[#12b76a]'} shadow-[0_0_0_5px_color-mix(in_srgb,currentColor_10%,transparent)]`} />
                      {attentionCount > 0
                        ? t('dashboard.attentionSummary', { count: attentionCount })
                        : t('dashboard.operationalSummary')}
                    </div>
                  </div>

                  <button
                    onClick={() => void checkAllClientSites(websitesRef.current, true)}
                    disabled={isRefreshing || websites.length === 0}
                    className="primary-button flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    <RefreshCcw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                    {t('dashboard.refreshAll')}
                  </button>
                </div>

                <div className="relative z-10 mt-5 flex max-w-3xl items-start gap-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-muted)]/70 px-3.5 py-3 text-xs leading-5 text-[var(--text-secondary)]">
                  <Laptop2 size={15} className="mt-0.5 flex-none text-[var(--accent-color)]" aria-hidden="true" />
                  <span>{t('dashboard.clientProbeNotice')}</span>
                </div>

                <div className="relative z-10 mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="metric-card rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">{t('dashboard.totalServices')}</span>
                      <Globe2 size={16} className="text-[var(--accent-color)]" />
                    </div>
                    <strong className="mt-3 block text-2xl font-semibold tracking-[-0.04em]">{websites.length}</strong>
                  </div>
                  <div className="metric-card rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">{t('dashboard.availability')}</span>
                      <Activity size={16} className="text-[var(--status-online-text)]" />
                    </div>
                    <strong className="mt-3 block text-2xl font-semibold tracking-[-0.04em]">{availability}%</strong>
                  </div>
                  <div className="metric-card rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">{t('dashboard.needsAttention')}</span>
                      <AlertTriangle size={16} className={attentionCount > 0 ? 'text-[var(--status-offline-text)]' : 'text-[var(--text-tertiary)]'} />
                    </div>
                    <strong className="mt-3 block text-2xl font-semibold tracking-[-0.04em]">{attentionCount}</strong>
                  </div>
                </div>
              </section>

              <section className="control-surface mt-5 flex flex-col gap-3 rounded-2xl p-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="scrollbar-hide flex min-w-0 gap-1 overflow-x-auto">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`category-pill whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold ${selectedCategory === 'all' ? 'category-pill-active' : ''}`}
                  >
                    {t('dashboard.all')}
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`category-pill whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold ${selectedCategory === cat.id ? 'category-pill-active' : ''}`}
                    >
                      {cat.id === 'default' ? t('dashboard.general') : cat.name}
                    </button>
                  ))}
                </div>

                <label className="relative block w-full flex-none sm:w-64 lg:w-72">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={16} />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={t('dashboard.searchPlaceholder')}
                    className="field-control h-10 rounded-xl py-2 pl-10 pr-3 text-sm"
                  />
                </label>
              </section>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredWebsites.map(site => (
                  <SiteCard
                    key={site.id}
                    site={site}
                    clientConnectivity={getClientConnectivity(site)}
                    onRefreshOne={(id) => void checkClientSite(id, websitesRef.current, true)}
                  />
                ))}
                {filteredWebsites.length === 0 && (
                  <div className="glass-panel col-span-full flex min-h-64 flex-col items-center justify-center rounded-[1.5rem] border-dashed p-10 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-color)]">
                      {normalizedSearch ? <SearchX size={25} /> : <Globe2 size={25} />}
                    </div>
                    <p className="text-base font-semibold text-[var(--text-primary)]">{t('dashboard.noSites')}</p>
                    <button onClick={checkAdminAccess} className="mt-2 text-sm font-semibold text-[var(--accent-color)] hover:underline">
                      {t('dashboard.loginToAdd')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'login' && (
            <div className="grid min-h-[calc(100vh-11rem)] animate-fade-in items-stretch gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <section className="hero-panel hidden min-h-[36rem] flex-col justify-between rounded-[1.75rem] p-8 lg:flex lg:p-10">
                <div className="relative z-10">
                  <span className="eyebrow"><ShieldCheck size={14} /> {t('login.securityCheck')}</span>
                  <h2 className="mt-5 max-w-lg text-4xl font-semibold tracking-[-0.045em] text-[var(--text-primary)]">
                    {t('login.title')}
                  </h2>
                  <p className="mt-4 max-w-md text-base leading-7 text-[var(--text-secondary)]">{t('login.subtitle')}</p>
                </div>
                <div className="relative z-10 grid gap-3 sm:grid-cols-2">
                  <div className="metric-card rounded-2xl p-4">
                    <Globe2 size={18} className="text-[var(--accent-color)]" />
                    <strong className="mt-4 block text-2xl">{websites.length}</strong>
                    <span className="mt-1 block text-xs font-medium text-[var(--text-secondary)]">{t('dashboard.totalServices')}</span>
                  </div>
                  <div className="metric-card rounded-2xl p-4">
                    <CheckCircle2 size={18} className="text-[var(--status-online-text)]" />
                    <strong className="mt-4 block text-2xl">{availability}%</strong>
                    <span className="mt-1 block text-xs font-medium text-[var(--text-secondary)]">{t('dashboard.availability')}</span>
                  </div>
                </div>
              </section>

              <div className="flex items-center justify-center py-4">
                <div className="modal-panel relative w-full max-w-md overflow-hidden rounded-[1.75rem] p-6 sm:p-8">
                  <div className="absolute inset-x-0 top-0 h-1 bg-[var(--accent-gradient)]" />

                  <div className="mb-7">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-color)] ring-1 ring-[var(--glass-border)]">
                      <LogIn size={21} />
                    </div>
                    <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--text-primary)]">{t('login.title')}</h2>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">{t('login.subtitle')}</p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    {loginError && (
                      <div className="rounded-xl border border-[var(--status-offline-border)] bg-[var(--status-offline-bg)] p-3 text-sm text-[var(--status-offline-text)]">
                        {loginError}
                      </div>
                    )}

                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-[var(--text-secondary)]">{t('login.username')}</label>
                      <input
                        type="text"
                        autoComplete="username"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        className="field-control rounded-xl px-4 py-3 text-sm"
                        placeholder={t('login.username')}
                        disabled={isLoggingIn}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-[var(--text-secondary)]">{t('login.password')}</label>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="field-control rounded-xl px-4 py-3 text-sm"
                        placeholder="••••••••"
                        disabled={isLoggingIn}
                      />
                    </div>

                    <div className="pt-1">
                      <label className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">{t('login.securityCheck')}</label>
                      <Captcha key={captchaRefreshKey} onValidate={handleCaptchaValidate} />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoggingIn || !turnstileToken}
                      className="primary-button mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoggingIn && <RefreshCcw size={15} className="animate-spin" />}
                      {isLoggingIn ? t('status.checking') : t('login.submit')}
                    </button>
                  </form>

                  <button
                    onClick={() => setView('dashboard')}
                    className="mt-6 flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    <ArrowLeft size={15} /> {t('login.back')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === 'admin' && (
            <div className="animate-fade-in">
              <AdminDashboard
                websites={websites}
                categories={categories}
                onAdd={addWebsite}
                onEdit={editWebsite}
                onDelete={deleteWebsite}
                onAddCategory={addCategory}
                onUpdateCategory={updateCategory}
                onDeleteCategory={deleteCategory}
                onRunServerChecks={runServerChecks}
                onLogout={handleLogout}
              />
            </div>
          )}

        </div>
      </main>

      <footer className="mt-auto px-4 pb-7 pt-3">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-3 border-t border-[var(--glass-border)] pt-5 text-xs text-[var(--text-tertiary)] sm:flex-row">
          <p>&copy; {new Date().getFullYear()} {t('appName')}</p>
          <p className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-online-text)]" />
            {t('dashboard.footer')}
          </p>
        </div>
      </footer>
    </div>
  );
}
