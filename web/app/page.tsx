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
      setError(body.message || 'This phone cannot sign in.');
      return;
    }
    setCode(body.code);
  }

  return (
    <section>
      <h1>AutoPost AI</h1>
      <p>Manage social media directly from WhatsApp.</p>
      <form onSubmit={submit}>
        <label>
          Tester phone
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="201012345678" />
        </label>
        <button type="submit">Get started</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {code ? (
        <p>
          Send <strong>{code}</strong> to the AutoPost WhatsApp number. The reply contains your studio link.
        </p>
      ) : null}
    </section>
  );
}
