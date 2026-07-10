<!--
SYNC IMPACT REPORT
==================
Version change: 0.0.0 → 1.0.0 (MAJOR - Initial constitution ratification)

Modified principles: None (initial version)

Added sections:
- Core Principles (4 principles tailored for MCP server development)
- Integration Standards (MCP-specific technical requirements)
- Development Workflow (streamlined process without unit testing)
- Governance

Removed sections: None

Templates requiring updates:
- .specify/templates/plan-template.md: ✅ Compatible (no changes needed)
- .specify/templates/spec-template.md: ✅ Compatible (no changes needed)
- .specify/templates/tasks-template.md: ✅ Compatible (tests marked as optional per template design)

Follow-up TODOs: None
==================
-->

# MCP Servers Constitution

## Core Principles

### I. Multi-Integration Architecture

Each MCP server integration MUST be a standalone, self-contained module within the monorepo structure.

**Requirements**:
- Each integration (GitLab, Jenkins, SonarQube, etc.) resides in its own directory
- Integrations MUST NOT have direct dependencies on other integration modules
- Common utilities and types MUST be placed in the `shared/` directory
- Each integration MUST define its own tool definitions, handlers, and client

**Rationale**: Enables independent development, deployment, and maintenance of each integration without cross-contamination of concerns.

### II. MCP Protocol Compliance

All servers MUST strictly adhere to the Model Context Protocol specification.

**Requirements**:
- Use `@modelcontextprotocol/sdk` as the foundation for all server implementations
- Tools MUST be defined with proper JSON schemas for input validation
- Error responses MUST follow MCP error format conventions
- Servers MUST support stdio transport as the primary communication method

**Rationale**: Protocol compliance ensures interoperability with Claude and other MCP-compatible clients.

### III. Configuration-Driven Design

Server behavior MUST be configurable through environment variables and configuration files.

**Requirements**:
- Sensitive data (tokens, credentials) MUST be loaded from environment variables only
- Service URLs and non-sensitive settings MAY use configuration files
- Each integration MUST document its required configuration in its README
- Configuration validation MUST occur at server startup

**Rationale**: Enables deployment flexibility across different environments without code changes.

### IV. Simplicity Over Abstraction

Implementations MUST favor straightforward, readable code over complex abstractions.

**Requirements**:
- Follow KISS (Keep It Simple, Stupid) and YAGNI (You Aren't Gonna Need It) principles
- Avoid premature optimization and over-engineering
- New features require explicit user request before implementation
- Integration-specific code stays in integration directories; only truly shared code goes in `shared/`

**Rationale**: MCP servers are integration glue code. Simplicity reduces maintenance burden and improves debuggability.

## Integration Standards

### Technical Requirements

**Language/Runtime**: TypeScript on Node.js 18+

**Dependencies**:
- `@modelcontextprotocol/sdk` for MCP protocol implementation
- TypeScript for type safety
- Minimal external dependencies per integration

**Project Structure**:
```
mcp-servers/
├── shared/                    # Common utilities and types
│   └── src/
├── gitlab-mcp-server/        # GitLab integration
│   └── src/
│       ├── index.ts          # Server entry point
│       ├── gitlab-client.ts  # API client
│       └── tools/            # Tool definitions and handlers
├── jenkins-mcp-server/       # Jenkins integration
│   └── src/
├── sonarqube-mcp-server/     # SonarQube integration
│   └── src/
└── config.json               # Shared configuration schema
```

**Tool Implementation Pattern**:
- `definitions.ts` - Tool schemas and metadata
- `handlers.ts` - Tool execution logic
- `index.ts` - Tool exports

### API Client Guidelines

- Use native `fetch` for HTTP requests
- Implement proper error handling with meaningful error messages
- Support authentication via environment-configured tokens
- Log requests at debug level for troubleshooting

## Development Workflow

### Testing Policy

Unit testing is NOT required for this project. Quality assurance relies on:
- TypeScript compilation for type safety
- Manual integration testing against target services
- Code review for logic verification

### Build Process

```bash
npm run build    # Compile TypeScript
npm run start    # Run server
npm run dev      # Development mode with watch
```

### Adding New Integrations

1. Create new directory: `{service}-mcp-server/`
2. Initialize with package.json and TypeScript config
3. Implement client and tools following existing patterns
4. Document configuration requirements
5. Update root config schema if needed

## Governance

This constitution supersedes all other development practices for this project.

**Amendment Process**:
- Proposed changes MUST be documented with rationale
- Changes require explicit approval before implementation
- Version updates follow semantic versioning

**Compliance**:
- All code contributions MUST adhere to these principles
- Complexity beyond these standards requires documented justification
- Refer to this document for development guidance

**Version**: 1.0.0 | **Ratified**: 2025-05-28 | **Last Amended**: 2025-05-28
