import React, { useState } from 'react';
import { Plus, Trash2, Edit2, X, Save, Search, LogOut, Palette, Download, Upload, Folder, Layers } from 'lucide-react';
import { Website, Category, Theme } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

interface AdminDashboardProps {
  websites: Website[];
  categories: Category[];
  onAdd: (site: Omit<Website, 'id' | 'status' | 'lastChecked'>) => void;
  onEdit: (site: Website) => void;
  onDelete: (id: string) => void;
  onAddCategory: (name: string) => Promise<void>;
  onUpdateCategory: (id: string, name: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  websites,
  categories,
  onAdd,
  onEdit,
  onDelete,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onLogout
}) => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  // Website Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Category Modal State
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('https://');
  const [description, setDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const resetForm = () => {
    setTitle('');
    setUrl('https://');
    setDescription('');
    // Default to first category
    if (categories.length > 0) setSelectedCategoryId(categories[0].id);
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
    setSelectedCategoryId(site.categoryId || (categories[0]?.id || ''));
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
          description,
          categoryId: selectedCategoryId
        });
      }
    } else {
      onAdd({
        title,
        url: formattedUrl,
        description,
        categoryId: selectedCategoryId
      });
    }
    setIsModalOpen(false);
    resetForm();
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    if (editingCategoryId) {
      await onUpdateCategory(editingCategoryId, categoryName);
    } else {
      await onAddCategory(categoryName);
    }
    setCategoryName('');
    setEditingCategoryId(null);
  };

  const startEditCategory = (cat: Category) => {
    setCategoryName(cat.name);
    setEditingCategoryId(cat.id);
  };

  const cancelEditCategory = () => {
    setCategoryName('');
    setEditingCategoryId(null);
  };

  const handleExport = () => {
    const exportData = websites.map(site => ({
      ...site,
      categoryName: categories.find(c => c.id === site.categoryId)?.name || 'General'
    }));
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
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
          iconUrl: site.iconUrl,
          categoryId: site.categoryId // valid if importing from same system
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
      <div className="glass-panel p-6 rounded-xl flex flex-col md:flex-row gap-6 md:items-center justify-between">
        <div>
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

        <div className="flex gap-2 mt-4 md:mt-0">
          <button
            onClick={() => setIsCategoryManagerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 glass-panel text-[var(--text-primary)] rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
          >
            <Folder size={18} />
            {t('admin.manageCategories')}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            className="hidden"
            accept=".json"
          />
          <button
            onClick={handleImportClick}
            className="flex items-center gap-2 px-4 py-2 glass-panel text-[var(--text-primary)] rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
            title={t('admin.import')}
          >
            <Upload size={18} />
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 glass-panel text-[var(--text-primary)] rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
            title={t('admin.export')}
          >
            <Download size={18} />
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium"
            title={t('admin.logout')}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent-color)] transition-colors" size={20} />
          <input
            type="text"
            placeholder={t('admin.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 glass-panel rounded-xl text-[var(--text-primary)] placeholder-gray-500 focus:ring-2 focus:ring-[var(--accent-color)] outline-none transition-all"
          />
        </div>
        <button
          onClick={handleOpenAdd}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-[var(--accent-color)] text-white px-6 py-3 rounded-xl hover:opacity-90 transition-all font-semibold shadow-lg shadow-pink-500/20"
        >
          <Plus size={20} />
          {t('admin.addWebsite')}
        </button>
      </div>

      {/* Website Table */}
      <div className="glass-panel overflow-hidden rounded-2xl border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-6 py-4 font-semibold text-[var(--text-primary)]">{t('admin.table.title')}</th>
                <th className="px-6 py-4 font-semibold text-[var(--text-primary)] hidden sm:table-cell">{t('admin.table.url')}</th>
                <th className="px-6 py-4 font-semibold text-[var(--text-primary)] hidden md:table-cell">{t('admin.table.category')}</th>
                <th className="px-6 py-4 font-semibold text-[var(--text-primary)] text-right">{t('admin.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredSites.map(site => (
                <tr key={site.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-[var(--text-primary)]">{site.title}</div>
                    <div className="text-xs text-[var(--text-secondary)] sm:hidden truncate max-w-[150px]">{site.url}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)] hidden sm:table-cell truncate max-w-[200px]">
                    {site.url}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)] hidden md:table-cell">
                    {categories.find(c => c.id === site.categoryId)?.name || t('dashboard.general')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(site)}
                        className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 rounded-lg transition-colors"
                        title={t('admin.edit')}
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => onDelete(site.id)}
                        className="p-2 text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title={t('admin.delete')}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSites.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[var(--text-secondary)]">
                    {t('admin.noSitesFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Website Edit/Add Modal */}
      {
        isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="glass-panel w-full max-w-lg rounded-2xl p-6 relative animate-slide-up border border-white/20 shadow-2xl">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={24} />
              </button>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-6">
                {editingId ? t('admin.modal.editTitle') : t('admin.modal.addTitle')}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{t('admin.modal.titleLabel')}</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-xl text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] outline-none"
                    placeholder={t('admin.modal.titlePlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{t('admin.modal.urlLabel')}</label>
                  <input
                    type="text"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-xl text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] outline-none"
                    placeholder="https://example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{t('admin.modal.categoryLabel')}</label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-xl text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] outline-none [&>option]:bg-gray-900"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.id === 'default' ? t('dashboard.general') : cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{t('admin.modal.descLabel')}</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-xl text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] outline-none h-24 resize-none"
                    placeholder={t('admin.modal.descPlaceholder')}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {t('admin.modal.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="bg-[var(--accent-color)] text-white px-6 py-2 rounded-xl hover:opacity-90 transition-all font-medium flex items-center gap-2"
                  >
                    <Save size={18} />
                    {t('admin.modal.save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Category Manager Modal */}
      {
        isCategoryManagerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="glass-panel w-full max-w-md rounded-2xl p-6 relative animate-slide-up border border-white/20 shadow-2xl">
              <button
                onClick={() => setIsCategoryManagerOpen(false)}
                className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={24} />
              </button>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-6">{t('admin.categoryModal.title')}</h3>

              <form onSubmit={handleCategorySubmit} className="mb-6 flex gap-2">
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder={t('admin.categoryModal.namePlaceholder')}
                  className="flex-1 px-4 py-2 bg-black/20 border border-white/10 rounded-xl text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] outline-none"
                />
                {editingCategoryId ? (
                  <>
                    <button
                      type="submit"
                      className="p-2 bg-[var(--accent-color)] text-white rounded-xl hover:opacity-90 transition-all"
                    >
                      <Save size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditCategory}
                      className="p-2 bg-white/10 text-[var(--text-primary)] rounded-xl hover:bg-white/20 transition-all"
                    >
                      <X size={20} />
                    </button>
                  </>
                ) : (
                  <button
                    type="submit"
                    disabled={!categoryName.trim()}
                    className="p-2 bg-[var(--accent-color)] text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    <Plus size={20} />
                  </button>
                )}
              </form>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-[var(--glass-border)] transition-colors">
                    <span className="font-medium text-[var(--text-primary)]">{cat.id === 'default' ? t('dashboard.general') : cat.name}</span>
                    {cat.id !== 'default' && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditCategory(cat)}
                          className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 rounded-lg transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => onDeleteCategory(cat.id)}
                          className="p-1.5 text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default AdminDashboard;
