'use client';

import { useEffect, useState } from 'react';

type Analytics = {
  postsPublished: number;
  reach: number | null;
  engagement: number | null;
  bestPost: { headline: string | null; brief: string } | null;
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch('/api/nest/analytics').then(async (response) => {
      if (!response.ok) {
        setError('Open the studio link from WhatsApp first.');
        return;
      }
      setData(await response.json());
    });
  }, []);

  return (
    <section>
      <h1>Last 30 days</h1>
      {error ? <p className="error">{error}</p> : null}
      {data ? (
        <>
          <p>Posts published: {data.postsPublished}</p>
          <p>Reach: {data.reach ?? 'Unavailable'}</p>
          <p>Engagement: {data.engagement ?? 'Unavailable'}</p>
          <p>Best post: {data.bestPost ? data.bestPost.headline || data.bestPost.brief : 'None yet'}</p>
        </>
      ) : null}
    </section>
  );
}
