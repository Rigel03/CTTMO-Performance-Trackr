import './globals.css';
import { Inter } from 'next/font/google';
import Providers from '@/components/Providers';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata = {
  title: 'PerfMon - Unified Performance Monitoring System',
  description: 'City Transport and Traffic Management Office — Transport Planning and Management Division Individual Performance Commitment and Review System',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'PerfMon',
    statusBarStyle: 'default',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FFD700',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
