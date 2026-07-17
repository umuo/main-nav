export interface Category {
  id: string;
  name: string;
}

export type ConnectivityStatus = 'online' | 'offline' | 'checking' | 'unknown';

export interface Website {
  id: string;
  title: string;
  url: string;
  description?: string;
  iconUrl?: string; // Auto-generated or custom
  status: ConnectivityStatus;
  lastChecked: number; // Timestamp
  latency?: number; // In ms
  categoryId?: string; // Optional for backward compatibility, but we will default it
}

export type ClientProbeReason =
  | 'browser-offline'
  | 'insecure-context'
  | 'local-network-denied'
  | 'local-network-permission-required'
  | 'mixed-content'
  | 'network-error'
  | 'timeout'
  | 'unsupported-url';

export interface ClientConnectivity {
  status: ConnectivityStatus;
  lastChecked: number;
  latency?: number;
  reason?: ClientProbeReason;
}

export type ClientConnectivityMap = Record<string, ClientConnectivity>;

export interface User {
  username: string;
  role: 'admin' | 'guest';
}

export type ViewState = 'dashboard' | 'login' | 'admin';

export type Language = 'zh' | 'en';

export type Theme = 'vibe' | 'sunset' | 'ocean' | 'minimal';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}
