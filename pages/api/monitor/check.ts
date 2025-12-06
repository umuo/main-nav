import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  try {
    const checkUrl = async (method: string) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(url, {
          method,
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SentinelNav/1.0; +http://localhost)'
          }
        });
        clearTimeout(timeout);
        return response;
      } catch (error) {
        clearTimeout(timeout);
        throw error;
      }
    };

    let response = await checkUrl('HEAD').catch(() => null);

    // If HEAD fails (status not ok or network error), try GET
    if (!response || !response.ok) {
      try {
        response = await checkUrl('GET');
      } catch (err) {
        // If GET also throws (network error), we consider it offline
        return res.status(200).json({ status: 'offline' });
      }
    }

    res.status(200).json({
      status: response && response.ok ? 'online' : 'offline',
      statusCode: response ? response.status : 0
    });
  } catch (error) {
    res.status(200).json({ status: 'offline' });
  }
}
