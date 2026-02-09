import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Templates',
  description: 'Browse markdown templates for READMEs, documentation, changelogs, and more. Start writing faster with pre-built templates.',
};

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
