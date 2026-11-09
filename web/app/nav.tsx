import Link from 'next/link';

export function Nav() {
  return (
    <nav>
      <Link href="/">Welcome</Link>
      <Link href="/connect">Accounts</Link>
      <Link href="/brand">Brand</Link>
      <Link href="/calendar">Calendar</Link>
      <Link href="/drafts">Drafts</Link>
      <Link href="/analytics">Analytics</Link>
    </nav>
  );
}
