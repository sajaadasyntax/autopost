import Link from 'next/link';

export function Nav() {
  return (
    <nav>
      <Link href="/">البداية</Link>
      <Link href="/connect">الحسابات</Link>
      <Link href="/brand">العلامة</Link>
      <Link href="/calendar">التقويم</Link>
      <Link href="/drafts">المسودات</Link>
      <Link href="/analytics">الإحصاءات</Link>
    </nav>
  );
}
