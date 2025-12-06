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
        setView('admin');
      } else {
        setAuthenticated(false);
      }
    } catch (e) {
      setAuthenticated(false);
    }
  };

  useEffect(() => {
    fetchWebsites();
  }, []);

  const fetchWebsites = async () => {
    try {
      const res = await fetch('/api/sites');
      if (res.ok) {
        const data = await res.json();
        setWebsites(data);
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
    } catch (error) {
      setWebsites(prev => prev.map(site =>
        site.id === id ? { ...site, status: 'offline', lastChecked: Date.now() } : site
      ));
    }
  };

  const checkAllSites = () => {
    websites.forEach(site => checkSingleSite(site.id));
  };

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
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-500">
      <header className="sticky top-0 z-40 glass-panel border-b-1 rounded-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('dashboard')}>
            <div className="w-10 h-10 glass-panel rounded-xl flex items-center justify-center text-[var(--accent-color)] group-hover:scale-110 transition-transform">
              <Wifi size={24} />
            </div>
            <h1 className="font-handwritten text-4xl text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-500 drop-shadow-md">{t('appName')}</h1>
          </div>

          <nav className="flex items-center gap-2 md:gap-4">
            {view === 'dashboard' && (
              <div className="hidden md:flex items-center gap-4 text-sm font-medium mr-4">
                <span className="flex items-center gap-1.5 text-green-500 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20 backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  {onlineCount} {t('dashboard.online')}
                </span>
                {offlineCount > 0 && (
                  <span className="flex items-center gap-1.5 text-red-500 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 backdrop-blur-sm">
                    <WifiOff size={12} />
                    {offlineCount} {t('dashboard.offline')}
                  </span>
                )}
              </div>
            )}

            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 rounded-lg transition-colors text-xs font-bold uppercase backdrop-blur-sm"
            >
              <Languages size={18} />
              <span>{language}</span>
            </button>

            {view === 'dashboard' ? (
              <button
                onClick={checkAdminAccess}
                className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium p-2 rounded-lg hover:bg-white/10 backdrop-blur-sm"
              >
                <Lock size={16} />
                <span className="hidden sm:inline">{t('dashboard.adminLogin')}</span>
              </button>
            ) : (
              <button
                onClick={() => setView('dashboard')}
                className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium p-2 rounded-lg hover:bg-white/10 backdrop-blur-sm"
              >
                <LayoutDashboard size={16} />
                <span className="hidden sm:inline">{t('dashboard.dashboardLink')}</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {view === 'dashboard' && (
            <div className="animate-fade-in-up">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-[var(--text-primary)] drop-shadow-sm">{t('dashboard.systemStatus')}</h2>
                  <p className="text-[var(--text-secondary)] mt-1 text-lg">{t('dashboard.monitoringDesc', { count: websites.length })}</p>
                </div>
                <button
                  onClick={() => checkAllSites()}
                  className="flex items-center gap-2 px-6 py-2 glass-panel text-[var(--text-primary)] rounded-xl hover:bg-white/10 transition-all text-sm font-medium"
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
                  <div className="col-span-full flex flex-col items-center justify-center p-12 text-center text-gray-400 glass-panel rounded-2xl border-dashed border-white/20">
                    <WifiOff size={48} className="mb-4 opacity-50" />
                    <p className="text-lg text-[var(--text-secondary)]">{t('dashboard.noSites')}</p>
                    <button onClick={checkAdminAccess} className="text-[var(--accent-color)] hover:underline mt-2 font-medium">{t('dashboard.loginToAdd')}</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'login' && (
            <div className="flex justify-center items-center min-h-[60vh] animate-fade-in">
              <div className="glass-panel p-8 rounded-2xl w-full max-w-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-[var(--accent-gradient)]"></div>

                <div className="text-center mb-8">
                  <div className="mx-auto w-16 h-16 bg-white/10 text-[var(--accent-color)] rounded-full flex items-center justify-center mb-4 backdrop-blur-md border border-white/10">
                    <LogIn size={28} />
                  </div>
                  <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t('login.title')}</h2>
                  <p className="text-[var(--text-secondary)] text-sm mt-1">{t('login.subtitle')}</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  {loginError && (
                    <div className="bg-red-500/20 text-red-200 p-3 rounded-lg text-sm text-center border border-red-500/30">
                      {loginError}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{t('login.username')}</label>
                    <input
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="w-full px-4 py-2 bg-black/10 border border-white/10 rounded-lg text-[var(--text-primary)] placeholder-gray-500 focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all"
                      placeholder={t('login.username')}
                      disabled={isLoggingIn}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{t('login.password')}</label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-black/10 border border-white/10 rounded-lg text-[var(--text-primary)] placeholder-gray-500 focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all"
                      placeholder="••••••••"
                      disabled={isLoggingIn}
                    />
                  </div>

                  <div className="pt-2">
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{t('login.securityCheck')}</label>
                    <Captcha onValidate={handleCaptchaValidate} />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full bg-[var(--accent-color)] text-white py-3 rounded-lg hover:opacity-90 transition-all font-semibold shadow-lg mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoggingIn ? t('status.checking') : t('login.submit')}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button onClick={() => setView('dashboard')} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
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

      <footer className="border-t border-white/10 py-8 bg-black/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-[var(--text-secondary)]">
          <p>&copy; {new Date().getFullYear()} {t('dashboard.footer')}</p>
        </div>
      </footer>
    </div>
  );
}
