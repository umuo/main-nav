import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Lock, LogIn, RefreshCcw, Wifi, WifiOff, Languages } from 'lucide-react';
import { Website, ViewState } from '../types';
import { getWebsites, saveWebsites, isAuthenticated, setAuthenticated } from '../services/storageService';
import { CHECK_INTERVAL_MS } from '../constants';
import { useTranslation } from '../contexts/LanguageContext';

import SiteCard from '../components/SiteCard';
import AdminDashboard from '../components/AdminDashboard';
import Captcha from '../components/Captcha';

export default function Home() {
  const { t, language, setLanguage } = useTranslation();
  const [view, setView] = useState<ViewState>('dashboard');
  const [websites, setWebsites] = useState<Website[]>([]);

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    checkSession();

    // const sites = getWebsites();
    // setWebsites(sites);
    // Moved to fetchWebsites()

    // Initial check moved to fetchWebsites logic
    // sites.forEach(site => { ... });

    const interval = setInterval(() => {
      checkAllSites();
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        setAuthenticated(true);
        setView('admin'); // Automatically go to admin if logged in? Maybe just set authed state.
        // Actually, let's keep view logic separate or user might get redirected unexpectedly.
        // But previously checkAdminAccess used isAuthenticated().
      } else {
        setAuthenticated(false);
      }
    } catch (e) {
      setAuthenticated(false);
    }
  };

  // ... (auth useEffects remain)

  // Load sites from API on mount
  useEffect(() => {
    fetchWebsites();
  }, []);

  const fetchWebsites = async () => {
    try {
      const res = await fetch('/api/sites');
      if (res.ok) {
        const data = await res.json();
        setWebsites(data);

        // Trigger check for unknown status sites?
        data.forEach((site: Website) => {
          if (site.status === 'unknown') {
            checkSingleSite(site.id, data);
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch websites', error);
    }
  };

  const checkSingleSite = async (id: string, currentList = websites) => {
    // Optimistic update locally
    const updatedList = currentList.map(site =>
      site.id === id ? { ...site, status: 'checking' as const } : site
    );
    setWebsites(updatedList);

    const siteToCheck = updatedList.find(s => s.id === id);
    if (!siteToCheck) return;

    try {
      const res = await fetch('/api/monitor/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: siteToCheck.url })
      });
      const result = await res.json();

      const newStatus = result.status;
      setWebsites(prev => prev.map(site =>
        site.id === id ? { ...site, status: newStatus, lastChecked: Date.now() } : site
      ));

      // Optional: Persist status to DB? 
      // User didn't explicitly ask for history, but it's good practice.
      // However, PUT requires auth token in my implementation.
      // If public dashboard checks status, it can't save to DB if DB PUT is protected.
      // For now, let's keep status ephemeral in client memory or allow public PUT for status only?
      // Let's keep it client-side only for status to avoid auth complexity for public view.

    } catch (error) {
      setWebsites(prev => prev.map(site =>
        site.id === id ? { ...site, status: 'offline', lastChecked: Date.now() } : site
      ));
    }
  };

  const checkAllSites = () => {
    websites.forEach(site => checkSingleSite(site.id));
  };

  // Removed saveWebsites watcher

  const handleCaptchaValidate = (isValid: boolean, token: string, answer: string) => {
    setIsCaptchaValid(isValid);
    setCaptchaToken(token);
    setCaptchaAnswer(answer);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCaptchaValid) {
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
          captchaToken,
          captchaAnswer
        })
      });

      if (res.ok) {
        setAuthenticated(true);
        setLoginError('');
        setLoginUsername('');
        setLoginPassword('');
        setView('admin');
      } else {
        setLoginError(t('login.errorAuth'));
      }
    } catch (error) {
      setLoginError("An unexpected error occurred.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthenticated(false);
    setView('dashboard');
  };

  const checkAdminAccess = () => {
    if (isAuthenticated()) {
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
        const newSite = await res.json();
        setWebsites([...websites, newSite]);
        checkSingleSite(newSite.id, [...websites, newSite]);
      }
    } catch (e) {
      alert(t('admin.errorAdd'));
    }
  };

  const editWebsite = async (updatedSite: Website) => {
    // Current UI might pass full object, API expects partial? API code handles name/url.
    try {
      const res = await fetch(`/api/sites/${updatedSite.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: updatedSite.title, url: updatedSite.url })
      });

      if (res.ok) {
        setWebsites(websites.map(w => w.id === updatedSite.id ? updatedSite : w));
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
          setWebsites(websites.filter(w => w.id !== id));
        }
      } catch (e) {
        alert('Failed to delete');
      }
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  const onlineCount = websites.filter(w => w.status === 'online').length;
  const offlineCount = websites.filter(w => w.status === 'offline').length;

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-800">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm backdrop-blur-md bg-opacity-90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-blue-200 shadow-md">
              <Wifi size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">{t('appName')}</h1>
          </div>

          <nav className="flex items-center gap-2 md:gap-4">
            {view === 'dashboard' && (
              <div className="hidden md:flex items-center gap-4 text-sm font-medium mr-4">
                <span className="flex items-center gap-1.5 text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  {onlineCount} {t('dashboard.online')}
                </span>
                {offlineCount > 0 && (
                  <span className="flex items-center gap-1.5 text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                    <WifiOff size={12} />
                    {offlineCount} {t('dashboard.offline')}
                  </span>
                )}
              </div>
            )}

            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-xs font-bold uppercase"
            >
              <Languages size={18} />
              <span>{language}</span>
            </button>

            {view === 'dashboard' ? (
              <button
                onClick={checkAdminAccess}
                className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors text-sm font-medium p-2 rounded-lg hover:bg-gray-50"
              >
                <Lock size={16} />
                <span className="hidden sm:inline">{t('dashboard.adminLogin')}</span>
              </button>
            ) : (
              <button
                onClick={() => setView('dashboard')}
                className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors text-sm font-medium p-2 rounded-lg hover:bg-gray-50"
              >
                <LayoutDashboard size={16} />
                <span className="hidden sm:inline">{t('dashboard.dashboardLink')}</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-grow bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {view === 'dashboard' && (
            <div className="animate-fade-in-up">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{t('dashboard.systemStatus')}</h2>
                  <p className="text-gray-500 mt-1">{t('dashboard.monitoringDesc', { count: websites.length })}</p>
                </div>
                <button
                  onClick={() => checkAllSites()}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm transition-all text-sm font-medium"
                >
                  <RefreshCcw size={16} />
                  {t('dashboard.refreshAll')}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {websites.map(site => (
                  <SiteCard
                    key={site.id}
                    site={site}
                    onRefreshOne={(id) => checkSingleSite(id)}
                  />
                ))}
                {websites.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center p-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
                    <WifiOff size={48} className="mb-4 opacity-50" />
                    <p className="text-lg">{t('dashboard.noSites')}</p>
                    <button onClick={checkAdminAccess} className="text-blue-600 hover:underline mt-2">{t('dashboard.loginToAdd')}</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'login' && (
            <div className="flex justify-center items-center min-h-[60vh] animate-fade-in">
              <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 w-full max-w-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>

                <div className="text-center mb-8">
                  <div className="mx-auto w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                    <LogIn size={24} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">{t('login.title')}</h2>
                  <p className="text-gray-500 text-sm mt-1">{t('login.subtitle')}</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  {loginError && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100">
                      {loginError}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('login.username')}</label>
                    <input
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                      placeholder={t('login.username')}
                      disabled={isLoggingIn}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('login.password')}</label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                      placeholder="••••••••"
                      disabled={isLoggingIn}
                    />
                  </div>

                  <div className="pt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('login.securityCheck')}</label>
                    <Captcha onValidate={handleCaptchaValidate} />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-lg shadow-blue-200 mt-4 disabled:bg-blue-400 disabled:cursor-not-allowed"
                  >
                    {isLoggingIn ? t('status.checking') : t('login.submit')}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button onClick={() => setView('dashboard')} className="text-sm text-gray-500 hover:text-gray-700">
                    &larr; {t('login.back')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === 'admin' && (
            <div className="animate-fade-in">
              <AdminDashboard
                websites={websites}
                onAdd={addWebsite}
                onEdit={editWebsite}
                onDelete={deleteWebsite}
                onLogout={handleLogout}
              />
            </div>
          )}

        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} {t('dashboard.footer')}</p>
        </div>
      </footer>
    </div>
  );
}
