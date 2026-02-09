import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { ThemedToaster } from '@/components/ui/themed-toaster';
import { CodeThemeStyle } from '@/components/editor/code-theme-style';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'GitMarkdown - Collaborative Markdown Editor with GitHub Sync',
  description:
    'A collaborative markdown editor with two-way GitHub sync, real-time collaboration, AI features, and a comment/review system.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "GitMarkdown",
              "description": "Collaborative markdown editor with GitHub sync",
              "applicationCategory": "DeveloperApplication",
              "operatingSystem": "Web",
              "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
              "featureList": ["GitHub sync", "Real-time collaboration", "AI editing", "Inline comments", "Version history"]
            })
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <CodeThemeStyle />
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
