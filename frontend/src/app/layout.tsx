import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Threadmate',
  description: 'A gentle companion for your research thread',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ height: '100vh', overflow: 'hidden', background: '#0a0618' }}>
        {children}
      </body>
    </html>
  )
}
