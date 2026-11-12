'use client';

import { FormEvent, useEffect, useState } from 'react';

type Account = {
  platform: string;
  connected: boolean;
  available: boolean;
  displayName: string;
  externalId: string;
};

const LABELS: Record<string, string> = {
  facebook: 'Facebook Page',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  x: 'X',
};

export default function ConnectPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fbPageId, setFbPageId] = useState('');
  const [igUserId, setIgUserId] = useState('');
  const [pageAccessToken, setPageAccessToken] = useState('');

  async function load() {
    const response = await fetch('/api/nest/accounts');
    if (response.status === 401) {
      setError('Open the studio link from WhatsApp first.');
      return;
    }
    applyAccounts(await response.json());
  }

  function applyAccounts(list: Account[]) {
    setAccounts(list);
    const facebook = list.find((account) => account.platform === 'facebook');
    const instagram = list.find((account) => account.platform === 'instagram');
    if (facebook?.externalId) {
      setFbPageId(facebook.externalId);
    }
    if (instagram?.externalId) {
      setIgUserId(instagram.externalId);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('Saving…');
    try {
      const response = await fetch('/api/nest/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fbPageId, igUserId, pageAccessToken }),
      });
      const body = (await response.json()) as { message?: string } | Account[];
      if (!response.ok) {
        setNotice('');
        setError((body as { message?: string }).message || 'Could not save the accounts.');
        return;
      }
      applyAccounts(body as Account[]);
      setPageAccessToken('');
      setNotice('Saved.');
    } catch {
      setNotice('');
      setError('Could not reach the studio API.');
    }
  }

  return (
    <section>
      <h1>Connected accounts</h1>
      {accounts
        .filter((account) => account.available || account.connected)
        .map((account) => (
          <article key={account.platform} className="card">
            <strong>{LABELS[account.platform] ?? account.platform}</strong>
            <p>{account.connected ? 'Connected' : 'Not connected'}</p>
            {account.connected ? (
              <p>
                {account.displayName}
                {account.externalId ? ` · ${account.externalId}` : ''}
              </p>
            ) : null}
          </article>
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
      {notice ? <p>{notice}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
