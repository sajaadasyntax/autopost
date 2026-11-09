import './globals.css';
import type { ReactNode } from 'react';
import { Nav } from './nav';

export const metadata = { title: 'AutoPost AI' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>
          <Nav />
          {children}
        </main>
      </body>
    </html>
  );
}
