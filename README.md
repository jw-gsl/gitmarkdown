# GitMarkdown

A collaborative markdown editor with two-way GitHub sync, real-time collaboration, and AI-powered editing.

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

> For a comprehensive step-by-step walkthrough, see the **[Complete Setup Guide](docs/SETUP.md)**.

### Prerequisites

- Node.js 20+ and npm/yarn/pnpm
- A GitHub account
- A Firebase project (free Spark plan works)
- An Anthropic and/or OpenAI API key (for AI features)

### Quick Start

```bash
# 1. Clone and install
git clone https://github.com/pooriaarab/gitmarkdown.git
cd gitmarkdown
npm install

# 2. Copy the env template
cp .env.example .env.local

# 3. Fill in your credentials (see sections below)

# 4. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Firebase Setup

1. Create a project at [Firebase Console](https://console.firebase.google.com/)
2. **Register a Web App** (Project Settings > General > Add app > Web) — copy the config values to `.env.local`
3. **Enable Authentication** (Build > Authentication > Sign-in method > GitHub) — you'll need the GitHub OAuth credentials from the next step
4. **Enable Cloud Firestore** (Build > Firestore Database > Create database > Start in test mode)
5. **Enable Realtime Database** (Build > Realtime Database > Create Database) — copy the URL (e.g. `https://your-project-default-rtdb.firebaseio.com`) to `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
6. **Generate Admin SDK key** (Project Settings > Service Accounts > Generate new private key) — copy `project_id`, `client_email`, and `private_key` to `.env.local`
7. **Apply security rules** — see [Security Rules](#security-rules) below

### GitHub OAuth Setup

1. Go to [GitHub Developer Settings > OAuth Apps > New](https://github.com/settings/applications/new)
2. Set:
   - **Homepage URL**: `http://localhost:3000`
   - **Callback URL**: `https://<YOUR_FIREBASE_PROJECT_ID>.firebaseapp.com/__/auth/handler`
3. Copy the **Client ID** and **Client Secret**
4. Enter them in **both**:
   - Your `.env.local` (`GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`)
   - Firebase Console > Authentication > Sign-in method > GitHub

### AI Provider Keys

At least one is required for AI features:

- **Anthropic**: Get a key at [console.anthropic.com](https://console.anthropic.com/settings/keys) → set `ANTHROPIC_API_KEY`
- **OpenAI**: Get a key at [platform.openai.com](https://platform.openai.com/api-keys) → set `OPENAI_API_KEY`

### Environment Variables

See [`.env.example`](.env.example) for the full list with inline comments explaining where to find each value.

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key | Yes |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | Yes |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | Yes |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | Yes |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | Yes |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | Yes |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | Realtime Database URL | Yes |
| `FIREBASE_ADMIN_PROJECT_ID` | Admin SDK project ID | Yes |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Admin SDK service account email | Yes |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Admin SDK private key (wrap in quotes) | Yes |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID | Yes |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key | No* |
| `OPENAI_API_KEY` | OpenAI API key | No* |
| `NEXT_PUBLIC_APP_URL` | App URL (default: http://localhost:3000) | Yes |
| `NEXT_PUBLIC_DEFAULT_AI_PROVIDER` | `anthropic` or `openai` | Yes |
| `NEXT_PUBLIC_DEFAULT_AI_MODEL` | Model name | Yes |

*At least one AI provider key is required.

### Security Rules

After creating your Firebase databases, you must apply security rules for them to work.

#### Firestore Rules

Go to **Firebase Console > Firestore Database > Rules** and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /comments/{commentId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth != null
        && resource.data.author.uid == request.auth.uid;
    }
    match /workspaces/{workspaceId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      match /{subcollection}/{docId} {
        allow read: if request.auth != null;
        allow write: if request.auth != null;
      }
    }
  }
}
```

#### Realtime Database Rules

Go to **Firebase Console > Realtime Database > Rules** and paste:

```json
{
  "rules": {
    "yjs": {
      "$workspaceId": {
        "$fileId": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      }
    },
    ".read": false,
    ".write": false
  }
}
```

#### Firestore Composite Index

The comments query requires a composite index. The easiest way: run the app, try to open a file, and check the browser console — you'll see an error with a **direct link** to create the index. Click it and confirm.

Alternatively, create it manually: **Firestore > Indexes > Create Index** with collection `comments`, fields `repoFullName` (Asc), `filePath` (Asc), `createdAt` (Asc).

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
