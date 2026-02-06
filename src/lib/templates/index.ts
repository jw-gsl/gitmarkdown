import type { Template } from '@/types';

export const templates: Template[] = [
  {
    id: 'blog-post',
    name: 'Blog Post',
    description: 'A structured blog post with title, intro, sections, and conclusion.',
    category: 'Content',
    icon: 'FileText',
    content: `# Blog Post Title

> A brief description of the blog post.

## Introduction

Start with a hook that grabs the reader's attention. Provide context for the topic.

## Main Point 1

Elaborate on your first key point. Use examples, data, or stories to support your argument.

## Main Point 2

Develop your second key argument. Include relevant details and evidence.

## Main Point 3

Present your third supporting point. Build on the previous sections.

## Conclusion

Summarize the key takeaways. End with a call to action or thought-provoking statement.

---

*Published on: [Date]*
*Author: [Your Name]*
`,
  },
  {
    id: 'rfc',
    name: 'RFC (Request for Comments)',
    description: 'A technical proposal document for team review.',
    category: 'Engineering',
    icon: 'FileCode',
    content: `# RFC: [Title]

- **Status**: Draft
- **Author**: [Your Name]
- **Date**: [Date]
- **Reviewers**: [Names]

## Summary

One paragraph summary of the proposal.

## Motivation

Why are we doing this? What problem does it solve?

## Detailed Design

### Overview

High-level description of the approach.

### Technical Details

Specific implementation details.

\`\`\`
// Example code or pseudocode
\`\`\`

### API Changes

List any API changes.

## Alternatives Considered

What other approaches were evaluated?

| Approach | Pros | Cons |
|----------|------|------|
| Option A | ... | ... |
| Option B | ... | ... |

## Rollout Plan

How will this be deployed?

- [ ] Phase 1: ...
- [ ] Phase 2: ...
- [ ] Phase 3: ...

## Open Questions

- Question 1?
- Question 2?
`,
  },
  {
    id: 'adr',
    name: 'Architecture Decision Record',
    description: 'Document architectural decisions and their context.',
    category: 'Engineering',
    icon: 'Landmark',
    content: `# ADR-[NUMBER]: [Title]

- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Date**: [Date]
- **Decision Makers**: [Names]

## Context

What is the issue that we're seeing that motivates this decision?

## Decision

What is the change that we're proposing?

## Consequences

### Positive

- Benefit 1
- Benefit 2

### Negative

- Tradeoff 1
- Tradeoff 2

### Neutral

- Observation 1

## Links

- Related ADR: [link]
- Discussion: [link]
`,
  },
  {
    id: 'readme',
    name: 'README',
    description: 'A comprehensive project README with standard sections.',
    category: 'Project',
    icon: 'BookOpen',
    content: `# Project Name

Brief description of the project.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()

## Features

- Feature 1
- Feature 2
- Feature 3

## Getting Started

### Prerequisites

- Node.js >= 18
- npm or yarn

### Installation

\`\`\`bash
git clone https://github.com/username/project.git
cd project
npm install
\`\`\`

### Configuration

Copy the example environment file:

\`\`\`bash
cp .env.example .env.local
\`\`\`

### Running

\`\`\`bash
npm run dev
\`\`\`

## Usage

Describe how to use the project.

## Contributing

1. Fork the repository
2. Create your feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'Add amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
`,
  },
  {
    id: 'changelog',
    name: 'Changelog',
    description: 'Track project changes following Keep a Changelog format.',
    category: 'Project',
    icon: 'History',
    content: `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- New feature description

### Changed

- Changed feature description

### Fixed

- Bug fix description

## [1.0.0] - YYYY-MM-DD

### Added

- Initial release
- Feature 1
- Feature 2

### Changed

- Change description

### Deprecated

- Deprecated feature description

### Removed

- Removed feature description

### Fixed

- Bug fix description

### Security

- Security fix description
`,
  },
];

export function getTemplate(id: string): Template | undefined {
  return templates.find((t) => t.id === id);
}

export function getTemplatesByCategory(): Record<string, Template[]> {
  return templates.reduce(
    (acc, template) => {
      if (!acc[template.category]) acc[template.category] = [];
      acc[template.category].push(template);
      return acc;
    },
    {} as Record<string, Template[]>
  );
}
