import React, { useState } from 'react';
import { ArrowUpRight, Clock3, Globe2, RefreshCw, Zap } from 'lucide-react';
import { Website } from '../types';
import { getFaviconUrl } from '../services/monitorService';
import { useTranslation } from '../contexts/LanguageContext';

interface SiteCardProps {
  site: Website;
  onRefreshOne: (id: string) => void;
}

const getHostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
};

const SiteCard: React.FC<SiteCardProps> = ({ site, onRefreshOne }) => {
  const { t } = useTranslation();
  const iconUrl = site.iconUrl || getFaviconUrl(site.url);
  const [failedIconUrl, setFailedIconUrl] = useState('');
  const hostname = getHostname(site.url);
  const showIcon = failedIconUrl !== iconUrl;

  const formatTime = (timestamp: number) => {
    if (timestamp === 0) return t('status.never');
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleCardClick = () => {
    window.open(site.url, '_blank', 'noopener,noreferrer');
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCardClick();
    }
  };

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`${site.title} · ${t(`status.${site.status}`)}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className={`site-card site-card-${site.status} group flex h-full cursor-pointer flex-col rounded-[1.35rem] p-5`}
    >
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="site-icon flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-2xl">
            {showIcon ? (
              // The favicon host is administrator-configured, so Next Image cannot use a static remote allowlist.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={iconUrl}
                alt=""
                className="h-full w-full object-contain p-2.5"
                onError={() => setFailedIconUrl(iconUrl)}
              />
            ) : (
              <Globe2 size={21} aria-hidden="true" className="text-[var(--accent-color)]" />
            )}
          </div>
          <div className="min-w-0">
            <span className={`status-badge status-${site.status}`}>
              {t(`status.${site.status}`)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRefreshOne(site.id);
          }}
          className="icon-button relative z-20 flex h-9 w-9 flex-none items-center justify-center rounded-xl"
          title={t('dashboard.checkNow')}
          aria-label={`${t('dashboard.checkNow')} · ${site.title}`}
        >
          <RefreshCw size={15} className={site.status === 'checking' ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="relative z-10 mt-6">
        <h3 className="line-clamp-1 text-[1.08rem] font-semibold tracking-[-0.02em] text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-color)]">
          {site.title}
        </h3>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[var(--text-secondary)]">
          {site.description || hostname}
        </p>
      </div>

      <div className="relative z-10 mt-auto pt-6">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[var(--text-tertiary)]">
          <Globe2 size={13} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{hostname}</span>
          <ArrowUpRight size={14} aria-hidden="true" className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
        <div className="flex items-center justify-between border-t border-[var(--glass-border)] pt-3 text-xs text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <Clock3 size={13} aria-hidden="true" />
            {formatTime(site.lastChecked)}
          </span>
          {site.status === 'online' && site.latency !== undefined && (
            <span className="flex items-center gap-1 font-semibold text-[var(--status-online-text)]">
              <Zap size={12} aria-hidden="true" />
              {site.latency} ms
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export default SiteCard;
