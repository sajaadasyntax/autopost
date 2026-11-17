'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/nest/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.message || 'تعذر تسجيل الدخول.');
      return;
    }
    router.push('/brand');
  }

  return (
    <section>
      <h1>أوتو بوست</h1>
      <p>ادخل برقم واتساب وكلمة المرور. أول دخول يحفظ كلمة المرور لهذا الرقم.</p>
      <form onSubmit={submit}>
        <label>
          رقم واتساب
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="249912345678" inputMode="tel" />
        </label>
        <label>
          كلمة المرور
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <button type="submit">دخول</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
