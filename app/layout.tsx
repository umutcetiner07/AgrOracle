import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'

const manrope = Manrope({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
})

export const metadata: Metadata = {
  title: 'BerekeLedger | Doğrulanmış Tarım ve Su Kayıt Platformu',
  description: 'Kazakistan için geliştirilen AI destekli akıllı sulama, veri defteri ve sübvansiyon denetim platformu.',
  keywords: ['BerekeLedger', 'akıllı sulama', 'su tasarrufu', 'tarım teknolojisi', 'Kazakistan', 'Almaty'],
  authors: [{ name: 'Umut Cetiner' }],
  openGraph: {
    title: 'BerekeLedger - Doğrulanmış Tarım ve Su Kayıt Platformu',
    description: 'Bölgesel su krizine teknoloji tabanlı asimetrik çözüm ve doğrulanmış telemetri defteri.',
    siteName: 'BerekeLedger',
    locale: 'tr_TR',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" className={manrope.variable}>
      <body className={`${manrope.className} bg-[#0a0f14] text-white antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  )
}