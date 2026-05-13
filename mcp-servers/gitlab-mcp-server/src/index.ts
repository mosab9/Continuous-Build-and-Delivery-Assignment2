#!/usr/bin/env node
/**
 * GitLab MCP Server
 *
 * Model Context Protocol server for GitLab source code management integration.
 * Provides tools for managing projects, branches, merge requests, issues,
 * pipelines, and repository files.
 *
 * Configuration (in order of precedence):
 *   1. Environment variables: GITLAB_URL, GITLAB_TOKEN
 *   2. Central config file: ../config.json
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { GitLabClient } from "./gitlab-client.js";
import { TOOLS, handleToolCall } from "./tools/index.js";

/**
 * GitLab configuration interface
 */
interface GitLabConfig {
  url: string;
  token: string;
}

/**
 * Find and load the central config file
 */
function loadCentralConfig(): { gitlab?: GitLabConfig } {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Look for config.json in parent directories
  const possiblePaths = [
    join(__dirname, "..", "..", "config.json"),
    join(__dirname, "..", "..", "..", "config.json"),
    join(__dirname, "..", "..", "..", "mcp-servers", "config.json"),
    join(process.cwd(), "config.json"),
    join(process.cwd(), "mcp-servers", "config.json"),
  ];

  for (const configPath of possiblePaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, "utf-8");
        console.error(`Loaded config from: ${configPath}`);
        return JSON.parse(content);
      } catch (error) {
        console.error(`Warning: Failed to parse config file: ${configPath}`);
      }
    }
  }

  console.error("No config.json found, using environment variables only");
  return {};
}

/**
 * Get configuration from central config and environment variables
 * Environment variables take precedence
 */
function getConfig(): GitLabConfig {
  const centralConfig = loadCentralConfig();
  const gitlabConfig: Partial<GitLabConfig> = centralConfig.gitlab || {};

  return {
    url: process.env.GITLAB_URL || gitlabConfig.url || "",
    token: process.env.GITLAB_TOKEN || gitlabConfig.token || "",
  };
}

/**
 * Validate configuration
 */
function validateConfig(config: GitLabConfig): void {
  const missing: string[] = [];

  if (!config.url) missing.push("url (GITLAB_URL or config.gitlab.url)");
  if (!config.token) missing.push("token (GITLAB_TOKEN or config.gitlab.token)");

  if (missing.length > 0) {
    console.error(`Error: Missing required configuration: ${missing.join(", ")}`);
    console.error(`
GitLab MCP Server Configuration:

Option 1: Create mcp-servers/config.json:
  {
    "gitlab": {
      "url": "http://localhost:9003",
      "token": "your-personal-access-token"
    }
  }

Option 2: Use environment variables:
  GITLAB_URL=http://localhost:9003 \\
  GITLAB_TOKEN=your-personal-access-token \\
  node dist/index.js

To generate a GitLab Personal Access Token:
  1. Log into GitLab
  2. Go to User Settings → Access Tokens
  3. Create a token with 'api' scope
    `);
    process.exit(1);
  }
}

/**
 * Create and configure the MCP server
 */
async function main() {
  // Load and validate configuration
  const config = getConfig();
  validateConfig(config);

  // Create GitLab client
  const gitlabClient = new GitLabClient(config);

  // Create MCP server
  const server = new Server(
    {
      name: "gitlab-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await handleToolCall(
      gitlabClient,
      name,
      (args as Record<string, unknown>) || {}
    );
    return {
      content: result.content,
      isError: result.isError,
    };
  });

  // Connect transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup (to stderr so it doesn't interfere with MCP protocol on stdout)
  console.error(`GitLab MCP Server started`);
  console.error(`Connected to: ${config.url}`);
}

// Run the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
