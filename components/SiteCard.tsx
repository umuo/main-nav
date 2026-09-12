import React, { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  Globe2,
  Laptop2,
  RefreshCw,
  Server,
  Star,
} from 'lucide-react';
import { ClientConnectivity, Website } from '../types';
import { getFaviconUrl } from '../services/monitorService';
import { useTranslation } from '../contexts/LanguageContext';

interface SiteCardProps {
  site: Website;
  clientConnectivity: ClientConnectivity;
  onRefreshOne: (id: string) => void;
  categoryName: string;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
  onVisit: (id: string) => void;
}
const getHostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
};

export default function SiteCard({
  site,
  clientConnectivity,
  onRefreshOne,
  categoryName,
  favorite,
  onToggleFavorite,
  onVisit,
}: SiteCardProps) {
  const { t, language } = useTranslation();
  const zh = language === 'zh';
  const iconUrl = site.iconUrl || getFaviconUrl(site.url);
  const [failedIconUrl, setFailedIconUrl] = useState('');
  const [expanded, setExpanded] = useState(false);
  const cardId = useId();
  const pointerFrame = useRef<number | null>(null);
  const pointerPosition = useRef({ x: 0, y: 0 });
  const pointerMedia = useRef<MediaQueryList | null>(null);
  const titleId = `bookmark-title-${cardId}`;
  const descriptionId = `bookmark-description-${cardId}`;
  const detailsId = `bookmark-details-${cardId}`;

  useEffect(() => {
    pointerMedia.current = window.matchMedia(
      '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    );

    return () => {
      if (pointerFrame.current !== null) {
        window.cancelAnimationFrame(pointerFrame.current);
      }
    };
  }, []);

  const updateGlassPointer = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch' || !pointerMedia.current?.matches) return;

    const card = event.currentTarget;
    pointerPosition.current = { x: event.clientX, y: event.clientY };
    if (pointerFrame.current !== null) return;

    // Keep the moving highlight outside React's render cycle.
    pointerFrame.current = window.requestAnimationFrame(() => {
      pointerFrame.current = null;
      const bounds = card.getBoundingClientRect();
      card.style.setProperty(
        '--glass-pointer-x',
        `${pointerPosition.current.x - bounds.left}px`,
      );
      card.style.setProperty(
        '--glass-pointer-y',
        `${pointerPosition.current.y - bounds.top}px`,
      );
      card.dataset.glassActive = 'true';
    });
  };

  const clearGlassPointer = (event: React.PointerEvent<HTMLElement>) => {
    if (pointerFrame.current !== null) {
      window.cancelAnimationFrame(pointerFrame.current);
      pointerFrame.current = null;
    }
    delete event.currentTarget.dataset.glassActive;
  };

  const hostname = getHostname(site.url);
  const clientStatusText =
    clientConnectivity.reason === 'local-network-permission-required'
      ? t('connectivity.permissionRequired')
      : ['insecure-context', 'local-network-denied', 'mixed-content'].includes(
            clientConnectivity.reason || '',
          )
        ? t('connectivity.browserLimited')
        : t(`status.${clientConnectivity.status}`);
  const formatTime = (value: number) =>
    value
      ? new Date(value).toLocaleTimeString(zh ? 'zh-CN' : 'en', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : t('status.never');
  const safeUrl = /^https?:\/\//i.test(site.url) ? site.url : undefined;
  return (
    <article
      className={`bookmark-card ${favorite ? 'is-favorite' : ''} ${expanded ? 'is-expanded' : ''}`}
      aria-labelledby={titleId}
      onPointerEnter={updateGlassPointer}
      onPointerMove={updateGlassPointer}
      onPointerLeave={clearGlassPointer}
      onPointerCancel={clearGlassPointer}
    >
      <div className="glass-card-spotlight" aria-hidden="true" />
      <div className="bookmark-main">
        <a
          className="bookmark-link"
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onVisit(site.id)}
          aria-label={`${site.title} · ${zh ? '在新标签页打开' : 'Open in a new tab'}`}
          aria-describedby={descriptionId}
        >
          <div className="bookmark-heading">
            <div className="bookmark-icon">
              {failedIconUrl !== iconUrl ? (
                // Administrators can configure any favicon host.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={iconUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={() => setFailedIconUrl(iconUrl)}
                />
              ) : (
                <span>
                  {site.title.slice(0, 1).toLocaleUpperCase() || (
                    <Globe2 size={22} aria-hidden="true" />
                  )}
                </span>
              )}
            </div>
            <div className="bookmark-title">
              <h2 id={titleId}>{site.title}</h2>
              <span>{hostname}</span>
            </div>
            <ArrowUpRight className="bookmark-arrow" size={17} aria-hidden="true" />
          </div>
          <p className="bookmark-description" id={descriptionId}>
            {site.description ||
              (zh
                ? `前往 ${site.title}，发现更多可能。`
                : `Visit ${site.title} and discover more.`)}
          </p>
        </a>
        <button
          type="button"
          className={`favorite-button ${favorite ? 'is-active' : ''}`}
          onClick={() => onToggleFavorite(site.id)}
          aria-pressed={favorite}
          aria-label={`${favorite ? (zh ? '取消收藏' : 'Remove favorite') : zh ? '收藏网站' : 'Favorite website'} · ${site.title}`}
          title={
            favorite
              ? zh
                ? '取消收藏'
                : 'Remove favorite'
              : zh
                ? '收藏网站'
                : 'Favorite website'
          }
        >
          <Star
            size={17}
            fill={favorite ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
        </button>
      </div>
      <div className="bookmark-footer">
        <span className="bookmark-category">{categoryName}</span>
        <button
          type="button"
          className={`bookmark-status status-dot-${clientConnectivity.status}`}
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-controls={expanded ? detailsId : undefined}
          aria-label={`${zh ? '连通性详情' : 'Connectivity details'} · ${site.title} · ${clientStatusText}`}
          title={clientStatusText}
        >
          <span className="traffic-light" aria-hidden="true" />
          {clientStatusText}
          <ChevronDown
            size={12}
            className={expanded ? 'rotate-180' : ''}
            aria-hidden="true"
          />
        </button>
      </div>
      {expanded && (
        <div
          className="bookmark-details"
          id={detailsId}
          role="region"
          aria-label={`${zh ? '连通性详情' : 'Connectivity details'} · ${site.title}`}
        >
          <div>
            <span>
              <Laptop2 size={13} aria-hidden="true" />
              {t('connectivity.client')}
            </span>
            <strong>
              {clientStatusText}
              {clientConnectivity.status === 'online' &&
              clientConnectivity.latency !== undefined
                ? ` · ${clientConnectivity.latency} ms`
                : ''}
            </strong>
          </div>
          {clientConnectivity.reason && (
            <p>{t(`connectivity.reason.${clientConnectivity.reason}`)}</p>
          )}
          <div>
            <span>
              <Server size={13} aria-hidden="true" />
              {t('connectivity.server')}
            </span>
            <strong>
              {t(`status.${site.status}`)}
              {site.serverStatusCode ? ` · HTTP ${site.serverStatusCode}` : ''}
              {site.status === 'online' && site.latency !== undefined
                ? ` · ${site.latency} ms`
                : ''}
            </strong>
          </div>
          {site.serverReason && (
            <p>{t(`connectivity.serverReason.${site.serverReason}`)}</p>
          )}
          <div className="bookmark-check">
            <span>
              {zh ? '上次检测' : 'Last checked'}{' '}
              {formatTime(clientConnectivity.lastChecked)}
            </span>
            <button
              type="button"
              onClick={() => onRefreshOne(site.id)}
              disabled={clientConnectivity.status === 'checking'}
              aria-busy={clientConnectivity.status === 'checking'}
              aria-label={`${t('dashboard.checkNow')} · ${site.title}`}
            >
              <RefreshCw
                size={12}
                aria-hidden="true"
                className={
                  clientConnectivity.status === 'checking' ? 'animate-spin' : ''
                }
              />
              {zh ? '重新检测' : 'Check again'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
