import type { Metadata, Viewport } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Electricity Monitor',
  description: 'Casa, Tesla Model 3 y CFE',
  manifest: '/manifest.webmanifest',
  applicationName: 'Electricity Monitor',
  appleWebApp: { capable: true, title: 'Electricity Monitor', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-180.png' },
};
export const viewport: Viewport = {
  themeColor: '#050906',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body style={{margin:0,background:'#050906',color:'#e7ffe9',fontFamily:'system-ui, sans-serif',touchAction:'pan-x pan-y'}}>
    <style>{`input, select, textarea { font-size: max(16px, 1em); }`}</style>
    {children}
    <Script src="/pwa-register.js" strategy="afterInteractive" />
  </body></html>;
}
