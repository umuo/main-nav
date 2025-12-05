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
    online: 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]',
    offline: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]',
    checking: 'bg-yellow-400 animate-pulse',
    unknown: 'bg-gray-300',
  };

  const getStatusText = (status: Website['status']) => {
    return t(`status.${status}`);
  };

  const formatTime = (ts: number) => {
    if (ts === 0) return t('status.never');
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="group relative bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 overflow-hidden flex flex-col h-full">
      {/* Top Status Indicator Line */}
      <div className={`h-1 w-full ${statusColors[site.status] === statusColors.checking ? 'bg-yellow-400' : site.status === 'online' ? 'bg-green-500' : site.status === 'offline' ? 'bg-red-500' : 'bg-gray-300'}`}></div>
      
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-4">
          <div className="relative">
             <img 
               src={getFaviconUrl(site.url)} 
               alt={`${site.title} icon`}
               className="w-12 h-12 rounded-lg bg-gray-50 object-contain p-1 border border-gray-100"
               onError={(e) => {
                 (e.target as HTMLImageElement).src = 'https://via.placeholder.com/48?text=WEB';
               }}
             />
             {/* Status Dot Overlay */}
             <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${statusColors[site.status]}`} title={getStatusText(site.status)}></div>
          </div>
          
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.preventDefault(); onRefreshOne(site.id); }}
              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50"
              title={t('dashboard.checkNow')}
            >
              <Activity size={16} />
            </button>
            <a 
              href={site.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-1 group-hover:text-blue-600 transition-colors line-clamp-1">{site.title}</h3>
          <p className="text-sm text-gray-500 line-clamp-2 mb-3 h-10">{site.description || site.url}</p>
        </div>

        <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
           <div className="flex items-center gap-1">
             <Clock size={12} />
             <span>{formatTime(site.lastChecked)}</span>
           </div>
           {site.status === 'online' && site.latency && (
             <span className="text-green-600 font-medium">{site.latency}ms</span>
           )}
        </div>
      </div>
      
      {/* Clickable Area for main card functionality */}
      <a href={site.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-0" aria-hidden="true" onClick={(e) => {
          // Prevent click if clicking action buttons
          if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a.text-gray-400')) {
              e.preventDefault();
          }
      }} />
    </div>
  );
};

export default SiteCard;