'use client';

import { FormEvent, useEffect, useState } from 'react';

type Account = { platform: string; connected: boolean; available: boolean; displayName: string };

export default function ConnectPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState('');
  const [fbPageId, setFbPageId] = useState('');
  const [igUserId, setIgUserId] = useState('');
  const [pageAccessToken, setPageAccessToken] = useState('');

  async function load() {
    const response = await fetch('/api/nest/accounts');
    if (response.status === 401) {
      setError('Open the studio link from WhatsApp first.');
      return;
    }
    setAccounts(await response.json());
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/nest/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fbPageId, igUserId, pageAccessToken }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.message || 'Could not save the accounts.');
      return;
    }
    setAccounts(await response.json());
    setPageAccessToken('');
  }

  return (
    <section>
      <h1>Connected accounts</h1>
      {accounts.map((account) => (
        <p key={account.platform}>
          {account.connected ? 'Connected' : account.available ? 'Not connected' : 'Unavailable'} {account.platform}{' '}
          {account.displayName}
        </p>
      ))}
      <p>
        <a href="/api/nest/oauth/facebook">Connect with Facebook</a>
      </p>
      <form onSubmit={save}>
        <label>
          Facebook Page id
          <input value={fbPageId} onChange={(event) => setFbPageId(event.target.value)} />
        </label>
        <label>
          Instagram user id
          <input value={igUserId} onChange={(event) => setIgUserId(event.target.value)} />
        </label>
        <label>
          Page token
          <input value={pageAccessToken} onChange={(event) => setPageAccessToken(event.target.value)} />
        </label>
        <button type="submit">Save accounts</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
