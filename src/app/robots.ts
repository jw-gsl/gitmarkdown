import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/templates'],
        disallow: ['/dashboard', '/api/', '/_next/'],
      },
    ],
    sitemap: 'https://gitmarkdown.com/sitemap.xml',
  };
}
