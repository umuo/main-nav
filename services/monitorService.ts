export const getFaviconUrl = (url: string): string => {
  try {
    const domain = new URL(url).origin;
    return `${domain}/favicon.ico`;
  } catch {
    return 'https://via.placeholder.com/48?text=WEB';
  }
};
