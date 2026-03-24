import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aqua Palm Dashboard',
  description: 'Office management dashboard for Aqua Palm Pool Service',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&f[]=satoshi@400,500,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">{children}</body>
    </html>
  )
}
