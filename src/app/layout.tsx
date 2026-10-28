import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Electricity Monitor', description: 'Casa, Tesla Model 3 y CFE' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body style={{margin:0,background:'#050906',color:'#e7ffe9',fontFamily:'system-ui, sans-serif'}}>{children}</body></html>; }
