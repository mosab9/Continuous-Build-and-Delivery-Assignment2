# SonarQube MCP Server

An MCP (Model Context Protocol) server that provides tools for interacting with SonarQube code quality analysis.

## Features

- List and search projects
- Get quality gate status
- Retrieve code metrics (coverage, bugs, vulnerabilities, code smells)
- View and filter issues
- Get security hotspots
- View code coverage details
- Check code duplications
- View source code
- Get analysis history
- Monitor background tasks

## Installation

```bash
cd mcp-servers/sonarqube-mcp-server
npm install
npm run build
```

## Configuration

Set the following environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `SONAR_URL` | SonarQube server URL (e.g., `http://localhost:9000`) | Yes |
| `SONAR_TOKEN` | SonarQube API token | Yes |

### Getting a SonarQube API Token

1. Log into SonarQube
2. Click your avatar (top right) → **My Account**
3. Go to **Security** tab
4. Under **Generate Tokens**, enter a name and click **Generate**
5. Copy the token (it won't be shown again)

## Usage

### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sonarqube": {
      "command": "node",
      "args": ["/path/to/sonarqube-mcp-server/dist/index.js"],
      "env": {
        "SONAR_URL": "http://localhost:9000",
        "SONAR_TOKEN": "sqa_your_token_here"
      }
    }
  }
}
```

### With the Simulator

```bash
cd ../mcp-simulator
npm install
SONAR_URL=http://localhost:9000 \
SONAR_TOKEN=sqa_your_token \
npm run test:sonar
```

### Standalone

```bash
SONAR_URL=http://localhost:9000 \
SONAR_TOKEN=sqa_your_token \
npm start
```

## Available Tools

### sonar_health_check

Check if SonarQube is accessible and get server version.

```json
{}
```

### sonar_list_projects

List all projects in SonarQube.

```json
{
  "query": "my-app",
  "page": 1,
  "page_size": 50
}
```

### sonar_get_quality_gate

Get quality gate status for a project.

```json
{
  "project_key": "my-project"
}
```

### sonar_get_metrics

Get code quality metrics for a project.

```json
{
  "project_key": "my-project",
  "metrics": ["coverage", "bugs", "vulnerabilities"]
}
```

Default metrics if not specified:
- coverage
- bugs
- vulnerabilities
- code_smells
- duplicated_lines_density
- ncloc (lines of code)
- security_hotspots

### sonar_get_issues

Get code issues for a project.

```json
{
  "project_key": "my-project",
  "severities": ["BLOCKER", "CRITICAL"],
  "types": ["BUG", "VULNERABILITY"],
  "resolved": false,
  "page": 1,
  "page_size": 20
}
```

**Severity values:** BLOCKER, CRITICAL, MAJOR, MINOR, INFO

**Type values:** BUG, VULNERABILITY, CODE_SMELL

### sonar_get_hotspots

Get security hotspots that need review.

```json
{
  "project_key": "my-project",
  "status": "TO_REVIEW",
  "page": 1,
  "page_size": 20
}
```

### sonar_get_coverage

Get detailed coverage information.

```json
{
  "project_key": "my-project"
}
```

### sonar_get_duplications

Get code duplications in a file.

```json
{
  "component_key": "my-project:src/main/java/MyClass.java"
}
```

### sonar_get_source

View source code with optional line range.

```json
{
  "component_key": "my-project:src/main/java/MyClass.java",
  "from_line": 10,
  "to_line": 50
}
```

### sonar_get_analysis_history

Get analysis history for a project.

```json
{
  "project_key": "my-project",
  "page": 1,
  "page_size": 10
}
```

### sonar_get_tasks

Get background analysis tasks.

```json
{
  "project_key": "my-project",
  "status": "SUCCESS",
  "page": 1,
  "page_size": 20
}
```

**Status values:** PENDING, IN_PROGRESS, SUCCESS, FAILED, CANCELED

### sonar_get_quality_gates

List all quality gates.

```json
{}
```

### sonar_get_rules

Search for analysis rules.

```json
{
  "languages": ["java", "javascript"],
  "severities": ["BLOCKER", "CRITICAL"],
  "types": ["BUG"],
  "page": 1,
  "page_size": 25
}
```

## Project Structure

```text
sonarqube-mcp-server/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts              # MCP server entry point
    ├── sonarqube-client.ts   # SonarQube API client
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

**User:** "Check the code quality of my-project"

**Claude:** Uses `sonar_get_quality_gate` and `sonar_get_metrics` to provide a summary.

**User:** "Show me all critical bugs"

**Claude:** Uses `sonar_get_issues` with `severities: ["CRITICAL"]` and `types: ["BUG"]`.

**User:** "What's the test coverage?"

**Claude:** Uses `sonar_get_coverage` to show coverage details.

**User:** "Are there any security issues I should look at?"

**Claude:** Uses `sonar_get_hotspots` to show security hotspots needing review.

## Metrics Reference

| Metric Key | Description |
|------------|-------------|
| `coverage` | Overall code coverage % |
| `line_coverage` | Line coverage % |
| `branch_coverage` | Branch coverage % |
| `bugs` | Number of bugs |
| `vulnerabilities` | Number of vulnerabilities |
| `code_smells` | Number of code smells |
| `security_hotspots` | Number of security hotspots |
| `duplicated_lines_density` | Duplication % |
| `ncloc` | Lines of code (non-comment) |
| `sqale_index` | Technical debt in minutes |
| `reliability_rating` | A-E rating for reliability |
| `security_rating` | A-E rating for security |
| `sqale_rating` | A-E rating for maintainability |

## License

MIT
