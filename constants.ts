import { Website } from './types';

export const APP_NAME = "SentinelNav";

// 更新间隔 (2小时)
export const CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000; 

export const DEFAULT_WEBSITES: Website[] = [
  {
    id: '1',
    title: 'Google',
    url: 'https://www.google.com',
    description: '全球最大的搜索引擎',
    status: 'unknown',
    lastChecked: 0
  },
  {
    id: '2',
    title: 'GitHub',
    url: 'https://github.com',
    description: '代码托管与开发者平台',
    status: 'unknown',
    lastChecked: 0
  },
  {
    id: '3',
    title: 'Stack Overflow',
    url: 'https://stackoverflow.com',
    description: '全球开发者问答社区',
    status: 'unknown',
    lastChecked: 0
  }
];
