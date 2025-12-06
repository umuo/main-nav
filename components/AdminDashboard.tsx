import React, { useState } from 'react';
import { Plus, Trash2, Edit2, X, Save, Search, LogOut, Palette, Download, Upload } from 'lucide-react';
import { Website } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { useTheme, Theme } from '../contexts/ThemeContext';

interface AdminDashboardProps {
  websites: Website[];
  onAdd: (site: Omit<Website, 'id' | 'status' | 'lastChecked'>) => void;
  onEdit: (site: Website) => void;
  onDelete: (id: string) => void;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ websites, onAdd, onEdit, onDelete, onLogout }) => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('https://');
  const [description, setDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const resetForm = () => {
    setTitle('');
    setUrl('https://');
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

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(websites, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "websites.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileObj = event.target.files && event.target.files[0];
    if (!fileObj) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!Array.isArray(json)) throw new Error("Invalid format");

        // Sanitize
        const sanitized = json.map(site => ({
          title: site.title,
          url: site.url,
          description: site.description,
          iconUrl: site.iconUrl
        }));

        const res = await fetch('/api/sites/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sanitized)
        });

        if (res.ok) {
          const result = await res.json();
          alert(t('admin.importSuccess', { count: result.count }));
          window.location.reload();
        } else {
          alert(t('admin.importError'));
        }
      } catch (err) {
        console.error(err);
        alert(t('admin.importError'));
      }
    };
    reader.readAsText(fileObj);
    event.target.value = '';
  };

  const filteredSites = websites.filter(site =>
    site.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const themes: { id: Theme; name: string; color: string }[] = [
    { id: 'vibe', name: 'Vibe', color: 'bg-purple-900' },
    { id: 'sunset', name: 'Sunset', color: 'bg-red-900' },
    { id: 'ocean', name: 'Ocean', color: 'bg-blue-900' },
    { id: 'minimal', name: 'Minimal', color: 'bg-gray-100' },
  ];

  return (
    <div className="space-y-6">
      {/* Settings Panel */}
      <div className="glass-panel p-6 rounded-xl">
        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Palette size={20} />
          Appearance
        </h3>
        <div className="flex gap-4">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex flex-col items-center gap-2 transition-transform hover:scale-105 ${theme === t.id ? 'ring-2 ring-[var(--text-primary)] rounded-lg p-1' : ''}`}
            >
              <div className={`w-12 h-12 rounded-lg shadow-lg border border-[var(--text-secondary)] ${t.color}`}></div>
              <span className="text-xs text-[var(--text-secondary)] font-medium">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-6 border-b border-[var(--glass-border)] flex flex-col md:flex-row justify-between items-center gap-4 bg-[var(--glass-bg)]">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{t('admin.title')}</h2>
            <p className="text-sm text-[var(--text-secondary)]">{t('admin.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Hidden Input */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".json"
              onChange={handleImport}
            />

            <div className="relative flex-grow md:flex-grow-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
              <input
                type="text"
                placeholder={t('admin.searchPlaceholder')}
                className="pl-10 pr-4 py-2 bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-lg text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-pink-500 focus:border-transparent w-full placeholder-[var(--text-secondary)] outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              onClick={handleExport}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-border)] rounded-lg transition-colors border border-[var(--glass-border)]"
              title={t('admin.export')}
            >
              <Download size={20} />
            </button>

            <button
              onClick={handleImportClick}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-border)] rounded-lg transition-colors border border-[var(--glass-border)]"
              title={t('admin.import')}
            >
              <Upload size={20} />
            </button>

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-lg hover:shadow-pink-500/30 whitespace-nowrap"
            >
              <Plus size={18} />
              {t('admin.addNew')}
            </button>
            <button
              onClick={onLogout}
              className="p-2 text-[var(--text-secondary)] hover:text-red-400 hover:bg-[var(--glass-border)] rounded-lg transition-colors"
              title={t('admin.logout')}
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--glass-bg)] border-b border-[var(--glass-border)] text-xs uppercase text-[var(--text-secondary)] font-semibold tracking-wider">
                <th className="px-6 py-4">{t('admin.table.website')}</th>
                <th className="px-6 py-4 hidden sm:table-cell">{t('admin.table.url')}</th>
                <th className="px-6 py-4 hidden md:table-cell">{t('admin.table.status')}</th>
                <th className="px-6 py-4 text-right">{t('admin.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {filteredSites.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[var(--text-secondary)]">
                    {t('admin.table.empty')}
                  </td>
                </tr>
              ) : (
                filteredSites.map(site => (
                  <tr key={site.id} className="hover:bg-[var(--glass-border)] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-[var(--text-primary)]">{site.title}</div>
                      <div className="text-xs text-[var(--text-secondary)] md:hidden">{site.url}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--text-secondary)] hidden sm:table-cell truncate max-w-xs">
                      {site.url}
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border"
                        style={{
                          backgroundColor: `var(--status-${site.status === 'unknown' ? 'checking' : site.status}-bg)`,
                          color: `var(--status-${site.status === 'unknown' ? 'checking' : site.status}-text)`,
                          borderColor: `var(--status-${site.status === 'unknown' ? 'checking' : site.status}-border)`
                        }}
                      >
                        {t(`status.${site.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(site)}
                          className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-[var(--glass-border)] rounded transition-colors"
                          title={t('admin.modal.editTitle')}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => onDelete(site.id)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-[var(--glass-border)] rounded transition-colors"
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
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all bg-[var(--bg-gradient)] border border-[var(--glass-border)]">
            <div className="px-6 py-4 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--glass-bg)]">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{editingId ? t('admin.modal.editTitle') : t('admin.modal.addTitle')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{t('admin.modal.titleLabel')}</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all placeholder-[var(--text-secondary)]"
                  placeholder={t('admin.modal.placeholderTitle')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{t('admin.modal.urlLabel')}</label>
                <input
                  type="text"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all placeholder-[var(--text-secondary)]"
                  placeholder={t('admin.modal.placeholderUrl')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{t('admin.modal.descLabel')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all h-24 resize-none placeholder-[var(--text-secondary)]"
                  placeholder={t('admin.modal.placeholderDesc')}
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--glass-border)] rounded-lg transition-colors font-medium border border-[var(--glass-border)]"
                >
                  {t('admin.modal.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium flex items-center gap-2 shadow-lg shadow-pink-900/40"
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
