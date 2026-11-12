'use client';

import { FormEvent, useState } from 'react';

export default function WelcomePage() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/nest/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.message || 'لا يمكن تسجيل الدخول بهذا الرقم.');
      return;
    }
    setCode(body.code);
  }

  return (
    <section>
      <h1>أوتو بوست</h1>
      <p>أدِر حساباتك من واتساب.</p>
      <form onSubmit={submit}>
        <label>
          رقم الهاتف
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="249912345678" />
        </label>
        <button type="submit">ابدأ</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {code ? (
        <p>
          أرسل <strong>{code}</strong> إلى رقم واتساب أوتو بوست. الرد يحتوي على رابط الاستوديو.
        </p>
      ) : null}
    </section>
  );
}
