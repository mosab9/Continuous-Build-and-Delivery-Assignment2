# GitLab MCP Server

A Model Context Protocol (MCP) server that provides tools for interacting with GitLab source code management.

## Features

This MCP server provides 20 tools for GitLab operations:

### Health & Authentication
- `gitlab_health_check` - Check server connectivity and get current user info

### Projects
- `gitlab_list_projects` - List projects with filtering options
- `gitlab_get_project` - Get detailed project information

### Branches
- `gitlab_list_branches` - List branches in a project
- `gitlab_create_branch` - Create a new branch

### Merge Requests
- `gitlab_list_merge_requests` - List merge requests with state filtering
- `gitlab_get_merge_request` - Get detailed merge request information
- `gitlab_create_merge_request` - Create a new merge request

### Issues
- `gitlab_list_issues` - List issues with state and label filtering
- `gitlab_create_issue` - Create a new issue

### CI/CD Pipelines
- `gitlab_list_pipelines` - List pipelines with status filtering
- `gitlab_get_pipeline` - Get pipeline details including jobs
- `gitlab_trigger_pipeline` - Trigger a new pipeline
- `gitlab_cancel_pipeline` - Cancel a running pipeline
- `gitlab_retry_pipeline` - Retry a failed pipeline
- `gitlab_get_job_log` - Get job log output

### Repository
- `gitlab_list_commits` - List commits in a repository
- `gitlab_get_file` - Get file content from repository
- `gitlab_list_tree` - List files and directories
- `gitlab_compare` - Compare branches, tags, or commits

## Installation

```bash
cd mcp-servers/gitlab-mcp-server
npm install
npm run build
```

## Configuration

### Option 1: Central Config File (Recommended)

Create or update `mcp-servers/config.json`:

```json
{
  "gitlab": {
    "url": "http://localhost:9003",
    "token": "your-personal-access-token"
  }
}
```

### Option 2: Environment Variables

```bash
export GITLAB_URL=http://localhost:9003
export GITLAB_TOKEN=your-personal-access-token
```

Environment variables take precedence over config file values.

## Generating a GitLab Personal Access Token

1. Log into GitLab
2. Go to **User Settings** → **Access Tokens**
3. Create a new token with the following scopes:
   - `api` - Full API access
   - `read_repository` - Read repository content
   - `write_repository` - Write repository content (for creating branches)
4. Copy the token and add it to your configuration

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "node",
      "args": ["/path/to/mcp-servers/gitlab-mcp-server/dist/index.js"],
      "env": {
        "GITLAB_URL": "http://localhost:9003",
        "GITLAB_TOKEN": "your-token"
      }
    }
  }
}
```

## Usage with MCP Simulator

```bash
cd mcp-simulator
npm start -- gitlab
```

## Example Tool Usage

### Health Check
```json
{
  "tool": "gitlab_health_check",
  "arguments": {}
}
```

### List Projects
```json
{
  "tool": "gitlab_list_projects",
  "arguments": {
    "owned": true,
    "search": "my-project"
  }
}
```

### Create Merge Request
```json
{
  "tool": "gitlab_create_merge_request",
  "arguments": {
    "project_id": "my-group/my-project",
    "source_branch": "feature-branch",
    "target_branch": "main",
    "title": "Add new feature",
    "description": "This MR adds a new feature..."
  }
}
```

### Trigger Pipeline
```json
{
  "tool": "gitlab_trigger_pipeline",
  "arguments": {
    "project_id": "123",
    "ref": "main",
    "variables": {
      "DEPLOY_ENV": "staging"
    }
  }
}
```

### Get File Content
```json
{
  "tool": "gitlab_get_file",
  "arguments": {
    "project_id": "my-group/my-project",
    "file_path": "src/index.ts",
    "ref": "main"
  }
}
```

## Development

```bash
# Watch mode for development
npm run dev

# Build for production
npm run build

# Clean build artifacts
npm run clean
```

## Architecture

```
gitlab-mcp-server/
├── src/
│   ├── index.ts           # Server entry point and configuration
│   ├── gitlab-client.ts   # GitLab API client
│   └── tools/
│       ├── definitions.ts # Tool schemas
│       ├── handlers.ts    # Tool implementations
│       └── index.ts       # Module exports
├── dist/                  # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
