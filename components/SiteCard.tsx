import React from 'react';
import { ExternalLink, Activity, Clock } from 'lucide-react';
import { Website } from '../types';
import { getFaviconUrl } from '../services/monitorService';
import { useTranslation } from '../contexts/LanguageContext';

interface SiteCardProps {
  site: Website;
  onRefreshOne: (id: string) => void;
}

const SiteCard: React.FC<SiteCardProps> = ({ site, onRefreshOne }) => {
  const { t } = useTranslation();

  const statusColors = {
    // Brighter colors for dark mode context
    online: 'bg-green-400 shadow-[0_0_15px_rgba(74,222,128,0.5)]',
    offline: 'bg-red-400 shadow-[0_0_15px_rgba(248,113,113,0.5)]',
    checking: 'bg-yellow-300 animate-pulse shadow-[0_0_15px_rgba(253,224,71,0.5)]',
    unknown: 'bg-gray-400',
  };

  const getStatusText = (status: Website['status']) => {
    return t(`status.${status}`);
  };

  const formatTime = (ts: number) => {
    if (ts === 0) return t('status.never');
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleCardClick = () => {
    window.open(site.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative glass-panel rounded-xl transition-all duration-300 hover:bg-[var(--glass-bg)] hover:shadow-lg hover:-translate-y-1 overflow-hidden flex flex-col h-full ring-1 ring-[var(--glass-border)] hover:ring-[var(--text-secondary)] cursor-pointer"
    >
      {/* Top Status Gradient Line */}
      <div className={`h-1 w-full bg-gradient-to-r ${site.status === 'online' ? 'from-green-400 to-emerald-600' : site.status === 'offline' ? 'from-red-400 to-pink-600' : 'from-yellow-300 to-orange-400'}`}></div>

      <div className="p-5 flex flex-col flex-grow relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className="relative">
            <img
              src={getFaviconUrl(site.url)}
              alt={`${site.title} icon`}
              className="w-12 h-12 rounded-xl bg-[var(--glass-bg)] object-contain p-1.5 backdrop-blur-sm border border-[var(--glass-border)] shadow-inner group-hover:scale-110 transition-transform duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/48/ffffff/000000?text=WEB';
              }}
            />
            {/* Status Dot Overlay */}
            <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-800 ${statusColors[site.status]}`} title={getStatusText(site.status)}></div>
          </div>

          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
            <button
              onClick={(e) => { e.stopPropagation(); onRefreshOne(site.id); }}
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--glass-bg)] transition-colors backdrop-blur-sm"
              title={t('dashboard.checkNow')}
            >
              <Activity size={16} />
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent-color)] transition-colors line-clamp-1 tracking-tight">{site.title}</h3>
          <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-4 h-10 leading-relaxed font-light">{site.description || site.url}</p>
        </div>

        <div className="mt-auto pt-4 border-t border-[var(--glass-border)] flex items-center justify-between text-xs text-[var(--text-secondary)] font-medium">
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]">{formatTime(site.lastChecked)}</span>
          </div>
          {site.status === 'online' && site.latency && (
            <span className="text-emerald-400 font-semibold bg-emerald-900/20 px-2 py-0.5 rounded-full border border-emerald-500/20">{site.latency}ms</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SiteCard;
