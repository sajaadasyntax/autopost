'use client';

import { useEffect, useState } from 'react';

type Post = { id: string; brief: string; headline: string | null; status: string; imageUrl: string | null; error: string | null };

const filters = ['', 'draft', 'scheduled', 'published', 'failed'];

export default function DraftsPage() {
  const [status, setStatus] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const query = status ? `?status=${status}` : '';
    void fetch(`/api/nest/posts${query}`).then(async (response) => {
      if (!response.ok) {
        setError('Open the studio link from WhatsApp first.');
        return;
      }
      setPosts(await response.json());
    });
  }, [status]);

  return (
    <section>
      <h1>Drafts</h1>
      <label>
        Filter
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          {filters.map((filter) => (
            <option key={filter || 'all'} value={filter}>
              {filter || 'all'}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="error">{error}</p> : null}
      {posts.map((post) => (
        <article className="card" key={post.id}>
          <strong>{post.headline || post.brief}</strong>
          <p>{post.status}</p>
          {post.imageUrl ? <img src={post.imageUrl} alt="" width={160} /> : null}
          {post.error ? <p className="error">{post.error}</p> : null}
        </article>
      ))}
    </section>
  );
}
