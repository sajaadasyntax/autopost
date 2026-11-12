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
        setError('افتح رابط الاستوديو من واتساب أولاً.');
        return;
      }
      setData(await response.json());
    });
  }, []);

  return (
    <section>
      <h1>آخر ٣٠ يوماً</h1>
      {error ? <p className="error">{error}</p> : null}
      {data ? (
        <>
          <p>المنشورات: {data.postsPublished}</p>
          <p>الوصول: {data.reach ?? 'غير متاح'}</p>
          <p>التفاعل: {data.engagement ?? 'غير متاح'}</p>
          <p>أفضل منشور: {data.bestPost ? data.bestPost.headline || data.bestPost.brief : 'لا يوجد بعد'}</p>
        </>
      ) : null}
    </section>
  );
}
