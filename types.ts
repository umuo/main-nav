export interface Category {
  id: string;
  name: string;
}

export interface Website {
  id: string;
  title: string;
  url: string;
  description?: string;
  iconUrl?: string; // Auto-generated or custom
  status: 'online' | 'offline' | 'checking' | 'unknown';
  lastChecked: number; // Timestamp
  latency?: number; // In ms
  categoryId?: string; // Optional for backward compatibility, but we will default it
}

export interface User {
  username: string;
  role: 'admin' | 'guest';
}

export type ViewState = 'dashboard' | 'login' | 'admin';

export type Language = 'zh' | 'en';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}