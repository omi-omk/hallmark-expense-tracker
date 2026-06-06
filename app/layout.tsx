import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { ServiceWorkerRegistration } from '@/components/sw-register'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Hallmark Expense Tracker',
  description: 'Track employee expenses',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Hallmark Expenses',
    statusBarStyle: 'default',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#ffffff" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={inter.className}>
        {children}
        <Toaster />
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
