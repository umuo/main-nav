import { Website } from '../types';
import { DEFAULT_WEBSITES } from '../constants';

const STORAGE_KEY = 'sentinel_nav_sites';
const AUTH_KEY = 'sentinel_nav_auth';

export const getWebsites = (): Website[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Initialize with defaults if empty
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WEBSITES));
      return DEFAULT_WEBSITES;
    }
    return JSON.parse(stored);
  } catch (e) {
    console.error("Failed to load websites", e);
    return DEFAULT_WEBSITES;
  }
};

export const saveWebsites = (sites: Website[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sites));
};

export const isAuthenticated = (): boolean => {
  const session = localStorage.getItem(AUTH_KEY);
  if (!session) return false;
  
  const parsed = JSON.parse(session);
  // Simple session expiry check (24 hours)
  const now = Date.now();
  if (now - parsed.timestamp > 24 * 60 * 60 * 1000) {
    localStorage.removeItem(AUTH_KEY);
    return false;
  }
  return true;
};

export const setAuthenticated = (value: boolean) => {
  if (value) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ loggedIn: true, timestamp: Date.now() }));
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
};
