# GitMarkdown

A collaborative markdown editor with two-way GitHub sync, real-time collaboration, and AI-powered editing.

![GitMarkdown Screenshot](./docs/screenshot.png)

## Overview

GitMarkdown is a modern, web-based markdown editor that seamlessly integrates with GitHub repositories. Edit markdown files with a rich WYSIWYG interface, collaborate in real-time with team members, and sync changes directly to GitHub. Built with Next.js 16 and powered by Tiptap v3, GitMarkdown combines the simplicity of markdown with the power of modern web technologies.

## Features

### Editor

- **Rich Text Editing** - Tiptap v3 WYSIWYG editor with full markdown support
- **Slash Commands** - Quick insertion of headings, lists, code blocks, tables, and more
- **Bubble Menu** - Context-aware formatting toolbar for text selections
- **Markdown Serialization** - Seamless conversion between rich text and markdown
- **Syntax Highlighting** - Code blocks with lowlight syntax highlighting
- **Tables & Task Lists** - Full support for GFM tables and interactive task lists
- **Typography** - Smart quotes, em dashes, and other typographic enhancements

### GitHub Integration

- **Two-Way Sync** - Pull changes from GitHub and push updates back
- **Multi-File Commits** - Commit multiple files at once using Git Tree API
- **Pull Request Creation** - Create PRs directly from the editor
- **Branch Management** - Switch between branches and view commit history
- **Version History** - Browse previous versions with side-by-side diff viewer
- **PR Comment Sync** - Sync inline comments with GitHub PR discussions

### Collaboration

- **Real-Time Editing** - Yjs CRDT-based collaboration with conflict-free merging
- **Active Users** - See who's currently editing with presence indicators
- **Cursor Tracking** - Real-time cursor positions and selections
- **Inline Comments** - Thread-based commenting system with reactions
- **Suggestions Mode** - Propose changes without directly editing content

### AI Features

- **AI Sidebar** - Chat interface for document assistance and content generation
- **Inline Editing** - Ctrl+K to trigger AI-powered text transformations
- **Mermaid Diagrams** - Generate flowcharts and diagrams from natural language
- **Multiple Providers** - Support for Anthropic Claude and OpenAI models
- **Context-Aware** - AI has full document context for better suggestions

### Document Management

- **File Tree** - Navigate repository structure with file icons
- **Template Gallery** - Quick-start templates (Blog Post, RFC, ADR, README, Changelog)
- **Table of Contents** - Auto-generated ToC from document headings
- **Backlinks** - Discover references between documents
- **Search & Filter** - Find files and content across your repository

### UI/UX

- **Dark/Light Theme** - System-aware theme switching
- **Responsive Design** - Works seamlessly on desktop and mobile
- **Keyboard Shortcuts** - Comprehensive shortcuts for power users
- **shadcn/ui Components** - Polished, accessible UI components
- **Tailwind CSS** - Modern, utility-first styling

## Tech Stack

### Frontend

- **Next.js 16** - React framework with Turbopack for fast development
- **TypeScript** - Type-safe development
- **Tiptap v3** - Headless editor framework built on ProseMirror
- **Yjs** - CRDT library for real-time collaboration
- **Zustand** - Lightweight state management
- **shadcn/ui** - Re-usable component library
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide Icons** - Beautiful icon set

### Backend & Services

- **Firebase Authentication** - GitHub OAuth integration
- **Cloud Firestore** - Document and comment storage
- **Firebase Realtime Database** - Real-time collaboration with y-fire
- **Vercel AI SDK v6** - Unified interface for AI providers
- **Anthropic Claude** - Primary AI provider
- **OpenAI** - Alternative AI provider
- **Octokit** - GitHub REST API client

### Development

- **TypeScript 5** - Latest TypeScript features
- **ESLint** - Code linting and formatting
- **Netlify** - Deployment and hosting

## Getting Started

### Prerequisites

- Node.js 20+ and npm/yarn/pnpm
- GitHub account for OAuth setup
- Firebase project with Authentication, Firestore, and Realtime Database enabled
- API keys for Anthropic and/or OpenAI

### Installation

1. Clone the repository:

```bash
git clone https://github.com/pooriaarab/gitmarkdown.git
cd gitmarkdown
```

2. Install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

4. Configure the environment variables (see below)

5. Run the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key | Yes |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | Yes |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | Yes |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | Yes |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | Yes |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | Yes |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | Firebase Realtime Database URL | Yes |
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase Admin project ID | Yes |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Firebase Admin service account email | Yes |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase Admin service account private key | Yes |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID | Yes |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | No* |
| `OPENAI_API_KEY` | OpenAI API key | No* |
| `NEXT_PUBLIC_APP_URL` | Your app URL (default: http://localhost:3000) | Yes |
| `NEXT_PUBLIC_DEFAULT_AI_PROVIDER` | Default AI provider (anthropic or openai) | Yes |
| `NEXT_PUBLIC_DEFAULT_AI_MODEL` | Default AI model name | Yes |

*At least one AI provider key is required for AI features to work.

### Firebase Setup

1. Create a new Firebase project at [firebase.google.com](https://firebase.google.com)
2. Enable Authentication with GitHub provider
3. Enable Cloud Firestore and Firebase Realtime Database
4. Generate a service account key for Firebase Admin SDK
5. Copy the configuration values to your `.env.local` file

### GitHub OAuth Setup

1. Go to [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/applications/new)
2. Create a new OAuth app with:
   - **Homepage URL**: `https://gitmarkdown-app.netlify.app` (or `http://localhost:3000` for local dev)
   - **Authorization callback URL**: `https://<YOUR_PROJECT>.firebaseapp.com/__/auth/handler`
3. Copy the Client ID and Client Secret
4. Also enter these in Firebase Console > Authentication > Sign-in method > GitHub
5. Add them to your `.env.local` file

## Project Structure

```
gitmarkdown/
├── src/
│   ├── app/                      # Next.js app directory
│   │   ├── (app)/               # Authenticated app routes
│   │   │   ├── dashboard/       # Repository dashboard
│   │   │   ├── templates/       # Template gallery
│   │   │   └── [owner]/[repo]/  # Repository editor
│   │   ├── (auth)/              # Authentication routes
│   │   └── api/                 # API routes
│   │       ├── ai/              # AI endpoints (chat, edit, mermaid)
│   │       ├── auth/            # Auth session management
│   │       ├── comments/        # Comment CRUD and sync
│   │       └── github/          # GitHub API proxies
│   ├── components/              # React components
│   │   ├── ai/                  # AI sidebar, edit popup, diff view
│   │   ├── collaboration/       # Active users, presence
│   │   ├── comments/            # Comment threads, input
│   │   ├── editor/              # Tiptap editor, toolbar, menus
│   │   ├── files/               # File tree navigation
│   │   ├── github/              # Sync, branches, commits, PRs
│   │   ├── layout/              # App header, navigation
│   │   ├── toc/                 # Table of contents, backlinks
│   │   └── ui/                  # shadcn/ui components
│   ├── hooks/                   # React hooks
│   │   ├── use-auth.ts          # Authentication hook
│   │   ├── use-collaboration.ts # Real-time collaboration
│   │   ├── use-editor.ts        # Editor state management
│   │   └── use-github.ts        # GitHub operations
│   ├── lib/                     # Core libraries
│   │   ├── ai/                  # AI provider configuration
│   │   ├── collaboration/       # Yjs setup, awareness
│   │   ├── editor/              # Tiptap extensions, config
│   │   ├── firebase/            # Firebase client and admin
│   │   ├── github/              # GitHub API wrappers
│   │   ├── templates/           # Document templates
│   │   └── utils/               # Utilities (diff, markdown, icons)
│   ├── providers/               # React context providers
│   │   ├── ai-provider.tsx      # AI configuration
│   │   ├── auth-provider.tsx    # Authentication state
│   │   ├── collaboration-provider.tsx # Yjs provider
│   │   └── github-provider.tsx  # GitHub client
│   ├── stores/                  # Zustand stores
│   │   ├── file-store.ts        # File tree state
│   │   ├── settings-store.ts    # User preferences
│   │   ├── sync-store.ts        # Sync status
│   │   └── ui-store.ts          # UI state (sidebars, etc.)
│   └── types/                   # TypeScript type definitions
├── public/                      # Static assets
├── .env.example                 # Environment variable template
├── next.config.js               # Next.js configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Dependencies and scripts
```

## Deployment

### Netlify Deployment

GitMarkdown is optimized for deployment on Netlify with the Next.js plugin.

1. Install Netlify CLI (optional):

```bash
npm install -g netlify-cli
```

2. Build the project:

```bash
npm run build
```

3. Deploy to Netlify:

#### Via Netlify UI

1. Connect your GitHub repository to Netlify
2. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
3. Add all environment variables from your `.env.local`
4. Deploy

#### Via Netlify CLI

```bash
netlify deploy --prod
```

### Environment Variables for Production

Make sure to set all environment variables in your Netlify dashboard, updating:

- `NEXT_PUBLIC_APP_URL` to your production domain
- GitHub OAuth callback URL to match your production domain
- Firebase authorized domains to include your production domain

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Key Features in Development

- **Hot Module Replacement** - Instant updates with Turbopack
- **Type Checking** - Real-time TypeScript validation
- **Fast Refresh** - Preserve component state during edits

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Tiptap](https://tiptap.dev) - Headless editor framework
- [Yjs](https://yjs.dev) - CRDT framework for real-time collaboration
- [shadcn/ui](https://ui.shadcn.com) - Beautiful UI components
- [Vercel AI SDK](https://sdk.vercel.ai) - AI integration toolkit
- [Octokit](https://octokit.github.io) - GitHub API client

---

Built with Next.js and deployed on Netlify.
