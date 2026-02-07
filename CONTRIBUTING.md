# Contributing to GitMarkdown

Thanks for your interest in contributing! This guide will help you get started.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. **Install** dependencies: `npm install`
4. **Copy** `.env.example` to `.env.local` and fill in your credentials (see [Setup Guide](docs/SETUP.md))
5. **Run** the dev server: `npm run dev`

## Development Workflow

1. Create a branch from `main`:
   ```bash
   git checkout -b feature/your-feature
   ```
2. Make your changes
3. Run checks before committing:
   ```bash
   npm run build      # Ensure it builds
   npx eslint src/    # Check for lint issues
   npx tsc --noEmit   # Type check
   ```
4. Commit with a clear message describing _what_ and _why_
5. Push to your fork and open a Pull Request

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include a description of what changed and why
- Add screenshots for UI changes
- Ensure the build passes before requesting review
- Link related issues if applicable

## Code Style

- **TypeScript** for all source files
- **Functional components** with hooks (no class components)
- Use existing patterns in the codebase as a reference
- Keep components focused and reasonably sized
- Use `shadcn/ui` primitives for new UI elements

## Project Structure

```
src/
  app/           # Next.js routes and API endpoints
  components/    # React components (organized by feature)
  hooks/         # Custom React hooks
  lib/           # Core libraries and utilities
  providers/     # React context providers
  stores/        # Zustand state stores
  types/         # TypeScript type definitions
```

## Reporting Bugs

Open an [issue](https://github.com/pooriaarab/gitmarkdown/issues) with:
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS info
- Screenshots if relevant

## Feature Requests

Open an [issue](https://github.com/pooriaarab/gitmarkdown/issues) tagged with `enhancement`. Describe the use case and proposed solution.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
