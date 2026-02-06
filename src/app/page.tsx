import Link from 'next/link';
import {
  GitBranch,
  Users,
  MessageSquare,
  Sparkles,
  FileText,
  ArrowRight,
  Github,
  Zap,
  Shield,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: GitBranch,
    title: 'Two-Way GitHub Sync',
    description: 'Push, pull, and create PRs directly from the editor. Your markdown stays in sync with your repository.',
  },
  {
    icon: Users,
    title: 'Real-Time Collaboration',
    description: 'Edit together with live cursors, presence indicators, and conflict-free merging powered by CRDTs.',
  },
  {
    icon: MessageSquare,
    title: 'Inline Comments & Reviews',
    description: 'Add comments, suggestions, and reactions directly on text. Syncs with GitHub PR reviews.',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Editing',
    description: 'Chat with AI about your docs, use Cmd+K for inline edits, and generate Mermaid diagrams automatically.',
  },
  {
    icon: FileText,
    title: 'Rich Markdown Editor',
    description: 'Notion-like editing experience with slash commands, tables, task lists, code blocks, and more.',
  },
  {
    icon: Zap,
    title: 'Templates & Diagrams',
    description: 'Start from templates (RFC, ADR, README) and generate flowcharts, sequence diagrams, and more.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">GitMarkdown</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/login">
              <Button>
                <Github className="mr-2 h-4 w-4" />
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center rounded-full border px-4 py-1.5 text-sm">
            <Sparkles className="mr-2 h-4 w-4 text-yellow-500" />
            Now with AI-powered editing
          </div>
          <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl">
            Google Docs meets GitHub
            <br />
            <span className="text-muted-foreground">for Markdown</span>
          </h1>
          <p className="mb-8 text-xl text-muted-foreground">
            A collaborative markdown editor with two-way GitHub sync, real-time collaboration, AI features, and inline
            reviews. Write better docs, together.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="h-12 px-8 text-base">
                <Github className="mr-2 h-5 w-5" />
                Sign in with GitHub
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                Learn More
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Demo Preview */}
      <section className="mx-auto max-w-5xl px-4 pb-24">
        <div className="overflow-hidden rounded-xl border bg-card shadow-2xl">
          <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-red-500/80" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
            <div className="h-3 w-3 rounded-full bg-green-500/80" />
            <span className="ml-2 text-sm text-muted-foreground">GitMarkdown Editor</span>
          </div>
          <div className="flex h-96">
            <div className="w-56 border-r bg-muted/30 p-4">
              <div className="mb-3 text-xs font-medium text-muted-foreground">FILES</div>
              <div className="space-y-1 text-sm">
                <div className="rounded bg-primary/10 px-2 py-1 font-medium text-primary">README.md</div>
                <div className="px-2 py-1 text-muted-foreground">docs/</div>
                <div className="px-2 py-1 pl-6 text-muted-foreground">getting-started.md</div>
                <div className="px-2 py-1 pl-6 text-muted-foreground">api-reference.md</div>
                <div className="px-2 py-1 text-muted-foreground">CHANGELOG.md</div>
              </div>
            </div>
            <div className="flex-1 p-6">
              <div className="space-y-4">
                <div className="h-8 w-48 rounded bg-muted" />
                <div className="h-4 w-full rounded bg-muted/60" />
                <div className="h-4 w-3/4 rounded bg-muted/60" />
                <div className="h-4 w-5/6 rounded bg-muted/60" />
                <div className="mt-6 h-6 w-36 rounded bg-muted" />
                <div className="h-4 w-full rounded bg-muted/60" />
                <div className="h-4 w-2/3 rounded bg-muted/60" />
              </div>
            </div>
            <div className="w-64 border-l bg-muted/20 p-4">
              <div className="mb-3 text-xs font-medium text-muted-foreground">AI ASSISTANT</div>
              <div className="space-y-3">
                <div className="rounded-lg bg-muted p-3">
                  <div className="h-3 w-full rounded bg-muted-foreground/20" />
                  <div className="mt-2 h-3 w-2/3 rounded bg-muted-foreground/20" />
                </div>
                <div className="rounded-lg bg-primary/10 p-3">
                  <div className="h-3 w-full rounded bg-primary/20" />
                  <div className="mt-2 h-3 w-5/6 rounded bg-primary/20" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-primary/20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold">Everything you need for collaborative docs</h2>
            <p className="text-lg text-muted-foreground">
              Built for teams that write markdown and use GitHub.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-xl border bg-card p-6 transition-shadow hover:shadow-md">
                <feature.icon className="mb-4 h-10 w-10 text-primary" />
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold">Ready to write better docs?</h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Connect your GitHub repos and start collaborating in minutes.
          </p>
          <Link href="/login">
            <Button size="lg" className="h-12 px-8 text-base">
              <Github className="mr-2 h-5 w-5" />
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            GitMarkdown
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              Open Source
            </span>
            <span className="flex items-center gap-1">
              <Globe className="h-4 w-4" />
              Built with Next.js
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
