# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in GitMarkdown, please report it responsibly.

**Do not open a public issue.**

Instead, reach out via X (Twitter): [@pooria_arab](https://x.com/pooria_arab)

Include:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will work with you to understand the issue and coordinate a fix before any public disclosure.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |

## Security Best Practices for Self-Hosting

- Never commit `.env.local` or any file containing secrets
- Set a strong, random `GITHUB_TOKEN_ENCRYPTION_KEY` in production
- Use Firebase security rules (provided in the README)
- Keep dependencies up to date
- Deploy behind HTTPS
