# Jenkins MCP Server

An MCP (Model Context Protocol) server that provides tools for interacting with Jenkins CI/CD pipelines.

## Features

- List and manage Jenkins jobs
- Trigger builds (with parameters)
- Get build status and logs
- Abort running builds
- View test results
- Get job configuration

## Installation

```bash
cd mcp-servers/jenkins-mcp-server
npm install
npm run build
```

## Configuration

Set the following environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `JENKINS_URL` | Jenkins server URL (e.g., `http://localhost:8080`) | Yes |
| `JENKINS_USER` | Jenkins username | Yes |
| `JENKINS_TOKEN` | Jenkins API token | Yes |

### Getting a Jenkins API Token

1. Log into Jenkins
2. Click your username (top right)
3. Click "Configure"
4. Under "API Token", click "Add new Token"
5. Give it a name and click "Generate"
6. Copy the token (it won't be shown again)

## Usage

### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "jenkins": {
      "command": "node",
      "args": ["/path/to/jenkins-mcp-server/dist/index.js"],
      "env": {
        "JENKINS_URL": "http://localhost:8080",
        "JENKINS_USER": "admin",
        "JENKINS_TOKEN": "your-api-token"
      }
    }
  }
}
```

### With the Simulator

```bash
cd ../mcp-simulator
npm install
JENKINS_URL=http://localhost:8080 \
JENKINS_USER=admin \
JENKINS_TOKEN=your-token \
npm run test:jenkins
```

### Standalone

```bash
JENKINS_URL=http://localhost:8080 \
JENKINS_USER=admin \
JENKINS_TOKEN=your-token \
npm start
```

## Available Tools

### jenkins_list_jobs

List all Jenkins jobs.

```json
{
  "folder": "optional-folder-name"
}
```

### jenkins_get_job

Get detailed information about a job.

```json
{
  "job_name": "my-pipeline"
}
```

### jenkins_trigger_build

Trigger a new build.

```json
{
  "job_name": "my-pipeline",
  "parameters": {
    "BRANCH": "main",
    "ENVIRONMENT": "staging"
  },
  "wait_for_start": true
}
```

### jenkins_get_build

Get build information.

```json
{
  "job_name": "my-pipeline",
  "build_number": 42
}
```

Use `build_number: -1` for the latest build.

### jenkins_get_build_log

Get console output.

```json
{
  "job_name": "my-pipeline",
  "build_number": -1,
  "max_lines": 500
}
```

### jenkins_abort_build

Stop a running build.

```json
{
  "job_name": "my-pipeline",
  "build_number": 42
}
```

### jenkins_get_job_config

Get job XML configuration.

```json
{
  "job_name": "my-pipeline"
}
```

### jenkins_get_test_results

Get test results for a build.

```json
{
  "job_name": "my-pipeline",
  "build_number": -1
}
```

### jenkins_get_queue

Check status of a queued build.

```json
{
  "queue_id": 123
}
```

### jenkins_health_check

Check if Jenkins is accessible.

```json
{}
```

## Project Structure

```text
jenkins-mcp-server/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts              # MCP server entry point
    ├── jenkins-client.ts     # Jenkins API client
    └── tools/
        ├── index.ts          # Tool exports
        ├── definitions.ts    # Tool schemas
        └── handlers.ts       # Tool implementations
```

## Development

```bash
# Watch mode (recompile on changes)
npm run dev

# Build
npm run build

# Clean build artifacts
npm run clean
```

## Example Conversation with Claude

**User:** "Can you check if my Jenkins server is running and list the available jobs?"

**Claude:** Uses `jenkins_health_check` and `jenkins_list_jobs` to provide the information.

**User:** "Trigger a build for the 'deploy-api' job with BRANCH=main"

**Claude:** Uses `jenkins_trigger_build` with the specified parameters.

**User:** "What's the status of that build? Show me the logs if it failed."

**Claude:** Uses `jenkins_get_build` and conditionally `jenkins_get_build_log` based on status.

## License

MIT
