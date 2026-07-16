import React, { useState } from 'react';
import {
  Download,
  Edit2,
  Folder,
  Globe2,
  LogOut,
  Palette,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
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
          categoryId: site.categoryId, // valid if importing from same system
          categoryName: site.categoryName
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

  const themes: { id: Theme; name: string; previewClass: string }[] = [
    { id: 'vibe', name: 'Vibe', previewClass: 'theme-vibe' },
    { id: 'sunset', name: 'Sunset', previewClass: 'theme-sunset' },
    { id: 'ocean', name: 'Ocean', previewClass: 'theme-ocean' },
    { id: 'minimal', name: 'Minimal', previewClass: 'theme-minimal' },
  ];

  const onlineCount = websites.filter(site => site.status === 'online').length;

  return (
    <div className="space-y-5">
      <section className="hero-panel rounded-[1.75rem] p-5 sm:p-7">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="eyebrow"><ShieldCheck size={14} /> {t('dashboard.workspace')}</span>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-[var(--text-primary)] sm:text-3xl">{t('admin.title')}</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{t('admin.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="secondary-button flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold">
              <Globe2 size={15} className="text-[var(--accent-color)]" />
              {t('admin.serviceCount', { count: websites.length })}
              <span className="text-[var(--status-online-text)]">· {onlineCount} {t('dashboard.online')}</span>
            </span>
            <button
              onClick={onLogout}
              className="flex h-10 items-center gap-2 rounded-xl border border-[var(--status-offline-border)] bg-[var(--status-offline-bg)] px-3.5 text-sm font-semibold text-[var(--status-offline-text)] transition-colors hover:brightness-110"
              title={t('admin.logout')}
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">{t('admin.logout')}</span>
            </button>
          </div>
        </div>
      </section>

      <section className="control-surface flex flex-col gap-5 rounded-2xl p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Palette size={16} className="text-[var(--accent-color)]" />
            {t('admin.appearance')}
          </h3>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">{t('admin.appearanceSubtitle')}</p>
          <div className="mt-3 flex flex-wrap gap-2 pb-1">
            {themes.map((themeOption) => (
              <button
                key={themeOption.id}
                onClick={() => setTheme(themeOption.id)}
                className={`flex flex-none items-center gap-2 rounded-xl border px-2 py-1.5 text-xs font-semibold transition-all ${
                  theme === themeOption.id
                    ? 'border-[var(--accent-color)] bg-[var(--accent-soft)] text-[var(--accent-color)]'
                    : 'border-[var(--glass-border)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                aria-pressed={theme === themeOption.id}
              >
                <span className={`theme-preview ${themeOption.previewClass} h-7 w-9 rounded-lg`} />
                {themeOption.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button
            onClick={() => setIsCategoryManagerOpen(true)}
            className="secondary-button flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold"
          >
            <Folder size={16} />
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
            className="icon-button flex h-10 w-10 items-center justify-center rounded-xl"
            title={t('admin.import')}
          >
            <Upload size={16} />
          </button>
          <button
            onClick={handleExport}
            className="icon-button flex h-10 w-10 items-center justify-center rounded-xl"
            title={t('admin.export')}
          >
            <Download size={16} />
          </button>
        </div>
      </section>

      {/* Action Bar */}
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={16} />
          <input
            type="text"
            placeholder={t('admin.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="field-control h-11 rounded-xl py-2 pl-10 pr-4 text-sm"
          />
        </div>
        <button
          onClick={handleOpenAdd}
          className="primary-button flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold sm:w-auto"
        >
          <Plus size={17} />
          {t('admin.addWebsite')}
        </button>
      </div>

      {/* Website Table */}
      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--glass-border)] bg-[var(--surface-muted)] text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                <th className="px-5 py-4 font-semibold">{t('admin.table.title')}</th>
                <th className="hidden px-5 py-4 font-semibold sm:table-cell">{t('admin.table.url')}</th>
                <th className="hidden px-5 py-4 font-semibold lg:table-cell">{t('admin.table.category')}</th>
                <th className="hidden px-5 py-4 font-semibold md:table-cell">{t('admin.table.status')}</th>
                <th className="px-5 py-4 text-right font-semibold">{t('admin.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {filteredSites.map(site => (
                <tr key={site.id} className="admin-table-row">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="site-icon flex h-9 w-9 flex-none items-center justify-center rounded-xl text-[var(--accent-color)]">
                        <Globe2 size={15} />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-[var(--text-primary)]">{site.title}</div>
                        <div className="mt-0.5 max-w-[170px] truncate text-xs text-[var(--text-tertiary)] sm:hidden">{site.url}</div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden max-w-[240px] px-5 py-4 text-sm text-[var(--text-secondary)] sm:table-cell">
                    <span className="block truncate">{site.url}</span>
                  </td>
                  <td className="hidden px-5 py-4 text-sm text-[var(--text-secondary)] lg:table-cell">
                    <span className="rounded-lg bg-[var(--surface-muted)] px-2.5 py-1.5 text-xs font-semibold">
                      {categories.find(c => c.id === site.categoryId)?.name || t('dashboard.general')}
                    </span>
                  </td>
                  <td className="hidden px-5 py-4 md:table-cell">
                    <span className={`status-badge status-${site.status}`}>{t(`status.${site.status}`)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(site)}
                        className="icon-button flex h-9 w-9 items-center justify-center rounded-xl"
                        title={t('admin.edit')}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => onDelete(site.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-[var(--text-secondary)] transition-colors hover:border-[var(--status-offline-border)] hover:bg-[var(--status-offline-bg)] hover:text-[var(--status-offline-text)]"
                        title={t('admin.delete')}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSites.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center text-sm text-[var(--text-secondary)]">
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
          <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="modal-panel relative w-full max-w-lg rounded-[1.5rem] p-6 animate-slide-up sm:p-7">
              <button
                onClick={() => setIsModalOpen(false)}
                className="icon-button absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl"
              >
                <X size={17} />
              </button>
              <h3 className="mb-6 pr-12 text-xl font-semibold tracking-[-0.025em] text-[var(--text-primary)]">
                {editingId ? t('admin.modal.editTitle') : t('admin.modal.addTitle')}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[var(--text-secondary)]">{t('admin.modal.titleLabel')}</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="field-control rounded-xl px-4 py-2.5 text-sm"
                    placeholder={t('admin.modal.titlePlaceholder')}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[var(--text-secondary)]">{t('admin.modal.urlLabel')}</label>
                  <input
                    type="text"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="field-control rounded-xl px-4 py-2.5 text-sm"
                    placeholder="https://example.com"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[var(--text-secondary)]">{t('admin.modal.categoryLabel')}</label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="field-control rounded-xl px-4 py-2.5 text-sm [&>option]:bg-[var(--page-bg)]"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.id === 'default' ? t('dashboard.general') : cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[var(--text-secondary)]">{t('admin.modal.descLabel')}</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="field-control h-24 resize-none rounded-xl px-4 py-2.5 text-sm"
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
                    className="primary-button flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
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
          <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="modal-panel relative w-full max-w-md rounded-[1.5rem] p-6 animate-slide-up sm:p-7">
              <button
                onClick={() => setIsCategoryManagerOpen(false)}
                className="icon-button absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl"
              >
                <X size={17} />
              </button>
              <h3 className="mb-6 pr-12 text-lg font-semibold tracking-[-0.025em] text-[var(--text-primary)]">{t('admin.categoryModal.title')}</h3>

              <form onSubmit={handleCategorySubmit} className="mb-6 flex gap-2">
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder={t('admin.categoryModal.namePlaceholder')}
                  className="field-control min-w-0 flex-1 rounded-xl px-4 py-2.5 text-sm"
                />
                {editingCategoryId ? (
                  <>
                    <button
                      type="submit"
                      className="primary-button flex h-10 w-10 items-center justify-center rounded-xl"
                    >
                      <Save size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditCategory}
                      className="icon-button flex h-10 w-10 items-center justify-center rounded-xl"
                    >
                      <X size={20} />
                    </button>
                  </>
                ) : (
                  <button
                    type="submit"
                    disabled={!categoryName.trim()}
                    className="primary-button flex h-10 w-10 items-center justify-center rounded-xl disabled:opacity-50"
                  >
                    <Plus size={20} />
                  </button>
                )}
              </form>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {categories.map(cat => (
                  <div key={cat.id} className="group flex items-center justify-between rounded-xl border border-[var(--glass-border)] bg-[var(--surface-muted)] p-3 transition-colors hover:border-[var(--accent-color)]">
                    <span className="font-medium text-[var(--text-primary)]">{cat.id === 'default' ? t('dashboard.general') : cat.name}</span>
                    {cat.id !== 'default' && (
                      <div className="flex gap-1 opacity-70 transition-opacity group-hover:opacity-100">
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
