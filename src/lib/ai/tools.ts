import { z } from 'zod';
import { tool } from 'ai';
import { Octokit } from '@octokit/rest';

// ─── Client-rendered tools (execute returns ack, client renders UI) ──────────

export const editFileTool = tool({
  description:
    'Edit text in the current file by finding and replacing a specific passage. ' +
    'oldText must be an EXACT verbatim substring from the document. ' +
    'newText is your replacement. The user sees a diff and can accept or reject.',
  inputSchema: z.object({
    oldText: z.string().describe('Exact text to find (must match verbatim)'),
    newText: z.string().describe('Replacement text'),
  }),
  execute: async () => ({ success: true, message: 'Edit shown to user for review.' }),
});

export const writeFileTool = tool({
  description:
    'Replace the entire content of the current file. Use for major rewrites or when changes are too extensive for editFile.',
  inputSchema: z.object({
    content: z.string().describe('Complete new file content'),
  }),
  execute: async () => ({ success: true, message: 'Full rewrite shown to user for review.' }),
});

export const createFileTool = tool({
  description:
    'Create a new file in the repository.',
  inputSchema: z.object({
    path: z.string().describe('File path relative to repo root'),
    content: z.string().describe('Complete file content'),
  }),
  execute: async () => ({ success: true, message: 'New file proposal shown to user.' }),
});

export const renameFileTool = tool({
  description:
    'Rename or move a file in the repository.',
  inputSchema: z.object({
    oldPath: z.string().describe('Current file path relative to repo root'),
    newPath: z.string().describe('New file path relative to repo root'),
  }),
  execute: async () => ({ success: true, message: 'Rename proposal shown to user.' }),
});

export const deleteFileTool = tool({
  description:
    'Delete a file from the repository. Use when the user explicitly asks to remove a file.',
  inputSchema: z.object({
    path: z.string().describe('File path relative to repo root'),
  }),
  execute: async () => ({ success: true, message: 'Delete proposal shown to user.' }),
});

export const suggestResponsesTool = tool({
  description:
    'Show the user 2-4 quick-reply buttons after your response. Use when there are clear next actions the user might want.',
  inputSchema: z.object({
    suggestions: z.array(z.string().describe('Button label (short, under 6 words)')).min(2).max(4),
  }),
  execute: async () => ({ success: true, message: 'Suggestions shown to user.' }),
});

export const commitChangesTool = tool({
  description:
    'Propose committing the current pending changes with a message. The user will review and confirm before any commit is made.',
  inputSchema: z.object({
    message: z.string().describe('Short commit message (imperative, under 72 chars)'),
    description: z.string().optional().describe('Optional longer description of changes'),
  }),
  execute: async () => ({ success: true, message: 'Commit proposal shown to user.' }),
});

export const createBranchTool = tool({
  description:
    'Propose creating a new branch in the repository. The user will review and confirm.',
  inputSchema: z.object({
    branchName: z.string().describe('Branch name (kebab-case, e.g. "feature/add-auth")'),
    sourceBranch: z.string().optional().describe('Branch to create from (defaults to current branch)'),
  }),
  execute: async () => ({ success: true, message: 'Branch proposal shown to user.' }),
});

// ─── Server-side tools (execute with GitHub/network access) ──────────────────

export interface ToolContext {
  owner: string;
  repo: string;
  branch: string;
  githubToken: string;
}

/** Create tools that require server-side context (GitHub API, network). */
export function createServerTools(ctx: ToolContext) {
  const hasAuth = !!ctx.githubToken;
  console.log('[AI Tools] Creating server tools:', {
    owner: ctx.owner,
    repo: ctx.repo,
    branch: ctx.branch,
    hasGithubToken: hasAuth,
  });
  const octokit = new Octokit({ auth: ctx.githubToken || undefined });

  const readFileTool = tool({
    description:
      'Read the content of a file from the repository. Use to examine files not currently open.',
    inputSchema: z.object({
      path: z.string().describe('File path relative to repo root'),
    }),
    execute: async ({ path }) => {
      console.log('[AI Tool] readFile:', { path, owner: ctx.owner, repo: ctx.repo, branch: ctx.branch, hasAuth });
      try {
        const { data } = await octokit.repos.getContent({
          owner: ctx.owner,
          repo: ctx.repo,
          path,
          ref: ctx.branch,
        });
        if ('content' in data && data.type === 'file') {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          console.log('[AI Tool] readFile OK:', { path, length: content.length });
          const MAX_CHARS = 30000;
          if (content.length > MAX_CHARS) {
            return { path, content: content.slice(0, MAX_CHARS), truncated: true, totalLength: content.length };
          }
          return { path, content, truncated: false };
        }
        return { error: `${path} is a directory, not a file.` };
      } catch (e: any) {
        console.error('[AI Tool] readFile FAILED:', { path, error: e.message, status: e.status });
        return { error: `Failed to read ${path}: ${e.message ?? 'Not found'}` };
      }
    },
  });

  const searchFilesTool = tool({
    description:
      'Search for files or code in the repository. Returns matching file paths and line snippets.',
    inputSchema: z.object({
      query: z.string().describe('Search query (text or code pattern)'),
      filePattern: z.string().optional().describe('Optional glob to filter files, e.g. "*.ts" or "src/**/*.tsx"'),
    }),
    execute: async ({ query, filePattern }) => {
      console.log('[AI Tool] searchFiles:', { query, filePattern, owner: ctx.owner, repo: ctx.repo, hasAuth });
      try {
        let q = `${query} repo:${ctx.owner}/${ctx.repo}`;
        if (filePattern) {
          const ext = filePattern.replace(/\*\*?\/?/g, '').replace(/^\*\./, '');
          if (ext && !ext.includes('*')) {
            q += ` extension:${ext}`;
          }
        }
        console.log('[AI Tool] searchFiles query:', q);
        const { data } = await octokit.rest.search.code({
          q,
          per_page: 10,
        });
        const results = data.items.map((item: any) => ({
          path: item.path,
          name: item.name,
        }));
        console.log('[AI Tool] searchFiles OK:', { total: data.total_count, resultCount: results.length });
        return { total: data.total_count, results, query };
      } catch (e: any) {
        console.error('[AI Tool] searchFiles FAILED:', { query, error: e.message, status: e.status });
        return { error: `Search failed: ${e.message ?? 'Unknown error'}` };
      }
    },
  });

  const listFilesTool = tool({
    description:
      'List files and directories at a given path in the repository.',
    inputSchema: z.object({
      path: z.string().optional().describe('Directory path relative to repo root (empty string or omit for root)'),
    }),
    execute: async ({ path }) => {
      try {
        const { data } = await octokit.repos.getContent({
          owner: ctx.owner,
          repo: ctx.repo,
          path: path || '',
          ref: ctx.branch,
        });
        if (Array.isArray(data)) {
          const entries = data.map((item: any) => ({
            name: item.name,
            path: item.path,
            type: item.type as 'file' | 'dir',
            size: item.size,
          }));
          return { path: path || '/', entries };
        }
        return { error: `${path} is a file, not a directory.` };
      } catch (e: any) {
        return { error: `Failed to list ${path || '/'}: ${e.message ?? 'Not found'}` };
      }
    },
  });

  const fetchURLTool = tool({
    description:
      'Fetch a URL and return its content as text. Use to import web articles, reference documentation, or check external resources.',
    inputSchema: z.object({
      url: z.string().url().describe('URL to fetch'),
    }),
    execute: async ({ url }) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'GitMarkdown-AI/1.0' },
        });
        clearTimeout(timeout);
        if (!res.ok) return { error: `HTTP ${res.status}: ${res.statusText}` };
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const json = await res.json();
          return { url, contentType: 'json', content: JSON.stringify(json, null, 2).slice(0, 20000) };
        }
        const text = await res.text();
        // Strip HTML tags for a rough text extraction
        const stripped = text
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const MAX = 20000;
        return {
          url,
          contentType: contentType.includes('html') ? 'html (text extracted)' : 'text',
          content: stripped.length > MAX ? stripped.slice(0, MAX) + '...(truncated)' : stripped,
        };
      } catch (e: any) {
        return { error: `Failed to fetch ${url}: ${e.message ?? 'Unknown error'}` };
      }
    },
  });

  const webSearchTool = tool({
    description:
      'Search the web for current information. Use when the user asks about something that requires up-to-date knowledge or external references.',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
    }),
    execute: async ({ query }) => {
      console.log('[AI Tool] webSearch:', { query });

      // Try Brave Search API if configured
      const braveKey = process.env.BRAVE_SEARCH_API_KEY;
      if (braveKey) {
        try {
          const res = await fetch(
            `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
            { headers: { 'X-Subscription-Token': braveKey, Accept: 'application/json' } }
          );
          if (res.ok) {
            const data = await res.json();
            const results = (data.web?.results ?? []).slice(0, 5).map((r: any) => ({
              title: r.title,
              url: r.url,
              description: r.description,
            }));
            console.log('[AI Tool] webSearch Brave OK:', { resultCount: results.length });
            return { query, results };
          }
          console.warn('[AI Tool] webSearch Brave failed:', res.status);
        } catch (e: any) {
          console.warn('[AI Tool] webSearch Brave error:', e.message);
        }
      } else {
        console.log('[AI Tool] webSearch: No BRAVE_SEARCH_API_KEY, trying DuckDuckGo fallback');
      }

      // Fallback: DuckDuckGo HTML search
      try {
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
          method: 'POST',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; GitMarkdown/1.0)',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `q=${encodeURIComponent(query)}`,
        });
        const text = await res.text();
        // DDG HTML results use class="result__a" for links
        const linkRegex = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        const results: { title: string; url: string }[] = [];
        let m;
        while ((m = linkRegex.exec(text)) && results.length < 5) {
          let url = m[1];
          // DDG wraps URLs in a redirect — extract the actual URL
          const uddgMatch = url.match(/uddg=([^&]+)/);
          if (uddgMatch) url = decodeURIComponent(uddgMatch[1]);
          results.push({ title: m[2].replace(/<[^>]+>/g, '').trim(), url });
        }
        console.log('[AI Tool] webSearch DDG:', { resultCount: results.length, htmlLength: text.length });
        if (results.length > 0) return { query, results };
        return { query, results: [], note: 'No results found. Try using fetchURL with a specific URL instead.' };
      } catch (e: any) {
        console.error('[AI Tool] webSearch DDG FAILED:', e.message);
        return { query, results: [], note: 'Web search unavailable. Use fetchURL with a known URL instead.' };
      }
    },
  });

  const getBranchesTool = tool({
    description:
      'List branches in the repository. Use to discover available branches or verify branch names.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const { data } = await octokit.repos.listBranches({
          owner: ctx.owner,
          repo: ctx.repo,
          per_page: 30,
        });
        return {
          currentBranch: ctx.branch,
          branches: data.map((b: any) => ({
            name: b.name,
            protected: b.protected,
          })),
        };
      } catch (e: any) {
        return { error: `Failed to list branches: ${e.message ?? 'Unknown error'}` };
      }
    },
  });

  const getCollaboratorsTool = tool({
    description:
      'List collaborators on the repository. Use to find who has access or to help with @mentions.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const { data } = await octokit.repos.listCollaborators({
          owner: ctx.owner,
          repo: ctx.repo,
          per_page: 30,
        });
        return {
          collaborators: data.map((c: any) => ({
            login: c.login,
            role: c.role_name,
            avatarUrl: c.avatar_url,
          })),
        };
      } catch (e: any) {
        // Fallback: collaborators endpoint requires push access, try contributors instead
        try {
          const { data } = await octokit.repos.listContributors({
            owner: ctx.owner,
            repo: ctx.repo,
            per_page: 30,
          });
          return {
            collaborators: (data ?? []).map((c: any) => ({
              login: c.login,
              contributions: c.contributions,
              avatarUrl: c.avatar_url,
            })),
          };
        } catch (e2: any) {
          return { error: `Failed to list collaborators: ${e2.message ?? 'Unknown error'}` };
        }
      }
    },
  });

  return {
    readFile: readFileTool,
    searchFiles: searchFilesTool,
    listFiles: listFilesTool,
    fetchURL: fetchURLTool,
    webSearch: webSearchTool,
    getBranches: getBranchesTool,
    getCollaborators: getCollaboratorsTool,
  };
}

/** Client-only tools (no server context needed). */
export const clientTools = {
  editFile: editFileTool,
  writeFile: writeFileTool,
  createFile: createFileTool,
  renameFile: renameFileTool,
  deleteFile: deleteFileTool,
  suggestResponses: suggestResponsesTool,
  commitChanges: commitChangesTool,
  createBranch: createBranchTool,
};

/** Build the full tool set with server context. */
export function createAllTools(ctx: ToolContext) {
  return {
    ...clientTools,
    ...createServerTools(ctx),
  };
}

/** Static tools for type reference / convertToModelMessages (no execute needed). */
export const aiTools = {
  ...clientTools,
  readFile: tool({
    description: 'Read a file from the repository.',
    inputSchema: z.object({ path: z.string() }),
    execute: async () => ({ error: 'Server context required' }),
  }),
  searchFiles: tool({
    description: 'Search for files or code in the repository.',
    inputSchema: z.object({ query: z.string(), filePattern: z.string().optional() }),
    execute: async () => ({ error: 'Server context required' }),
  }),
  listFiles: tool({
    description: 'List files in a directory.',
    inputSchema: z.object({ path: z.string().optional() }),
    execute: async () => ({ error: 'Server context required' }),
  }),
  fetchURL: tool({
    description: 'Fetch a URL.',
    inputSchema: z.object({ url: z.string() }),
    execute: async () => ({ error: 'Server context required' }),
  }),
  webSearch: tool({
    description: 'Search the web.',
    inputSchema: z.object({ query: z.string() }),
    execute: async () => ({ error: 'Server context required' }),
  }),
  getBranches: tool({
    description: 'List repository branches.',
    inputSchema: z.object({}),
    execute: async () => ({ error: 'Server context required' }),
  }),
  getCollaborators: tool({
    description: 'List repository collaborators.',
    inputSchema: z.object({}),
    execute: async () => ({ error: 'Server context required' }),
  }),
};
