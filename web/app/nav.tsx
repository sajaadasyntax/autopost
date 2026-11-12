'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'البداية' },
  { href: '/templates', label: 'القوالب' },
  { href: '/brand', label: 'العلامة' },
  { href: '/connect', label: 'الحسابات' },
  { href: '/calendar', label: 'التقويم' },
  { href: '/drafts', label: 'المسودات' },
  { href: '/analytics', label: 'الإحصاءات' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <p className="brand-mark">أوتو بوست</p>
      {links.map((link) => (
        <Link key={link.href} href={link.href} className={pathname === link.href ? 'active' : ''}>
          {link.label}
        </Link>
      ))}
    </aside>
  );
}
