import React, { useState } from 'react';
import { Plus, Trash2, Edit2, X, Save, Search, LogOut } from 'lucide-react';
import { Website } from '../types';
import { useTranslation } from '../contexts/LanguageContext';

interface AdminDashboardProps {
  websites: Website[];
  onAdd: (site: Omit<Website, 'id' | 'status' | 'lastChecked'>) => void;
  onEdit: (site: Website) => void;
  onDelete: (id: string) => void;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ websites, onAdd, onEdit, onDelete, onLogout }) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const resetForm = () => {
    setTitle('');
    setUrl('');
    setDescription('');
    setEditingId(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (site: Website) => {
    setTitle(site.title);
    setUrl(site.url);
    setDescription(site.description || '');
    setEditingId(site.id);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    let formattedUrl = url;
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    if (editingId) {
      // Find existing to preserve status/id
      const existing = websites.find(w => w.id === editingId);
      if (existing) {
        onEdit({
          ...existing,
          title,
          url: formattedUrl,
          description
        });
      }
    } else {
      onAdd({
        title,
        url: formattedUrl,
        description
      });
    }
    setIsModalOpen(false);
    resetForm();
  };

  const filteredSites = websites.filter(site => 
    site.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    site.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{t('admin.title')}</h2>
          <p className="text-sm text-gray-500">{t('admin.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="relative flex-grow md:flex-grow-0">
             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
             <input 
               type="text" 
               placeholder={t('admin.searchPlaceholder')}
               className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
           <button 
             onClick={handleOpenAdd}
             className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm whitespace-nowrap"
           >
             <Plus size={18} />
             {t('admin.addNew')}
           </button>
           <button 
             onClick={onLogout}
             className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
             title={t('admin.logout')}
           >
             <LogOut size={20} />
           </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
              <th className="px-6 py-4">{t('admin.table.website')}</th>
              <th className="px-6 py-4 hidden sm:table-cell">{t('admin.table.url')}</th>
              <th className="px-6 py-4 hidden md:table-cell">{t('admin.table.status')}</th>
              <th className="px-6 py-4 text-right">{t('admin.table.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredSites.length === 0 ? (
               <tr>
                 <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                   {t('admin.table.empty')}
                 </td>
               </tr>
            ) : (
              filteredSites.map(site => (
                <tr key={site.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{site.title}</div>
                    <div className="text-xs text-gray-500 md:hidden">{site.url}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell truncate max-w-xs">
                    {site.url}
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                      ${site.status === 'online' ? 'bg-green-100 text-green-800' : 
                        site.status === 'offline' ? 'bg-red-100 text-red-800' : 
                        'bg-gray-100 text-gray-800'}`}>
                      {t(`status.${site.status}`)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleOpenEdit(site)}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                        title={t('admin.modal.editTitle')}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => onDelete(site.id)}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                        title={t('admin.modal.delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">{editingId ? t('admin.modal.editTitle') : t('admin.modal.addTitle')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.modal.titleLabel')}</label>
                <input 
                  type="text" 
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  placeholder={t('admin.modal.placeholderTitle')}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.modal.urlLabel')}</label>
                <input 
                  type="text" 
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  placeholder={t('admin.modal.placeholderUrl')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.modal.descLabel')}</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all h-24 resize-none"
                  placeholder={t('admin.modal.placeholderDesc')}
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                >
                  {t('admin.modal.cancel')}
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                >
                  <Save size={18} />
                  {editingId ? t('admin.modal.update') : t('admin.modal.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;