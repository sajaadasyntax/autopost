'use client';

import { useEffect, useState } from 'react';

type Post = { id: string; brief: string; headline: string | null; status: string; scheduledAt: string | null };

const STATUS: Record<string, string> = {
  generating: 'قيد الإنشاء',
  draft: 'مسودة',
  scheduled: 'مجدول',
  publishing: 'قيد النشر',
  published: 'منشور',
  failed: 'فشل',
};

export default function CalendarPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch('/api/nest/calendar').then(async (response) => {
      if (!response.ok) {
        setError('افتح رابط الاستوديو من واتساب أولاً.');
        return;
      }
      setPosts(await response.json());
    });
  }, []);

  return (
    <section>
      <h1>تقويم المحتوى</h1>
      {error ? <p className="error">{error}</p> : null}
      {posts.map((post) => (
        <article className="card" key={post.id}>
          <strong>{post.scheduledAt ? new Date(post.scheduledAt).toLocaleString('ar') : 'غير مجدول'}</strong>
          <p>
            {post.headline || post.brief} · {STATUS[post.status] ?? post.status}
          </p>
        </article>
      ))}
    </section>
  );
}
