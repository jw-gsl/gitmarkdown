# GitMarkdown MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server that exposes
GitMarkdown capabilities as tools any MCP-compatible agent can call.

## Endpoint

```
POST /api/mcp
```

The server uses the MCP Streamable HTTP transport in stateless mode (no sessions).
All requests use JSON-RPC 2.0 over HTTP POST.

## Authentication

Every request must include one of the following:

1. **Bearer token** (Firebase ID token):
   ```
   Authorization: Bearer <firebase-id-token>
   ```
   The server verifies the token via Firebase Admin Auth, then retrieves the
   user's encrypted GitHub token from Firestore.

2. **API key** (for headless agents):
   ```
   X-API-Key: <your-api-key>
   ```
   Valid keys are configured via the `MCP_API_KEYS` environment variable
   (comma-separated). When using API key auth, set `MCP_GITHUB_TOKEN` to a
   GitHub personal access token that the server will use for GitHub API calls.

## Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_repos` | List repos accessible to the authenticated user | _(none)_ |
| `list_files` | List files in a repo via git tree | `owner`, `repo`, `branch?` |
| `read_file` | Read a file's content | `owner`, `repo`, `path`, `branch?` |
| `write_file` | Create or update a file | `owner`, `repo`, `path`, `content`, `message`, `sha?`, `branch?` |
| `delete_file` | Delete a file | `owner`, `repo`, `path`, `sha`, `message`, `branch?` |
| `list_branches` | List branches | `owner`, `repo` |
| `list_pulls` | List pull requests | `owner`, `repo`, `state?` |
| `create_pull` | Create a pull request | `owner`, `repo`, `title`, `body`, `head`, `base` |
| `search_files` | Search files by name pattern | `owner`, `repo`, `query`, `branch?` |
| `list_comments` | List comments on a file | `owner`, `repo`, `path?` |

## Example: MCP Client Config

Add this to your MCP client configuration (e.g., Claude Desktop, Claude Code):

```json
{
  "mcpServers": {
    "gitmarkdown": {
      "url": "https://your-app.vercel.app/api/mcp",
      "headers": {
        "X-API-Key": "your-api-key-here"
      }
    }
  }
}
```

## Example: Manual JSON-RPC Calls

### Initialize

```bash
curl -X POST https://your-app.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "my-client", "version": "1.0.0" }
    },
    "id": 1
  }'
```

### List Tools

```bash
curl -X POST https://your-app.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 2
  }'
```

### Call a Tool

```bash
curl -X POST https://your-app.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "list_repos",
      "arguments": {}
    },
    "id": 3
  }'
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MCP_API_KEYS` | Comma-separated list of valid API keys for headless agent access |
| `MCP_GITHUB_TOKEN` | GitHub personal access token used when authenticating via API key |
