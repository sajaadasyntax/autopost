'use client';

import { useEffect, useState } from 'react';

type Post = { id: string; brief: string; headline: string | null; status: string; scheduledAt: string | null };

export default function CalendarPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch('/api/nest/calendar').then(async (response) => {
      if (!response.ok) {
        setError('Open the studio link from WhatsApp first.');
        return;
      }
      setPosts(await response.json());
    });
  }, []);

  return (
    <section>
      <h1>Content calendar</h1>
      {error ? <p className="error">{error}</p> : null}
      {posts.map((post) => (
        <article className="card" key={post.id}>
          <strong>{post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : 'Unscheduled'}</strong>
          <p>
            {post.headline || post.brief} · {post.status}
          </p>
        </article>
      ))}
    </section>
  );
}
