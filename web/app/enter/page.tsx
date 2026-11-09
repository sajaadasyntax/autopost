'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function EnterInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setError('This login link is missing.');
      return;
    }
    void fetch('/api/nest/enter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      if (!response.ok) {
        setError('This login link has expired.');
        return;
      }
      router.replace('/brand');
    });
  }, [params, router]);

  return <section>{error ? <p className="error">{error}</p> : <p>Opening the studio…</p>}</section>;
}

export default function EnterPage() {
  return (
    <Suspense>
      <EnterInner />
    </Suspense>
  );
}
