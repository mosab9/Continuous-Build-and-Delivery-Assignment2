#!/usr/bin/env node

/**
 * Jenkins MCP Server
 *
 * An MCP server that provides tools for interacting with Jenkins CI/CD.
 *
 * Configuration (in order of precedence):
 *   1. Environment variables: JENKINS_URL, JENKINS_USER, JENKINS_TOKEN
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
import { JenkinsClient } from "./jenkins-client.js";
import { TOOLS } from "./tools/definitions.js";
import { toolHandlers } from "./tools/handlers.js";

/**
 * Jenkins configuration interface
 */
interface JenkinsConfig {
  url: string;
  user: string;
  token: string;
}

/**
 * Find and load the central config file
 */
function loadCentralConfig(): { jenkins?: JenkinsConfig } {
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
function getConfig(): JenkinsConfig {
  const centralConfig = loadCentralConfig();
  const jenkinsConfig = centralConfig.jenkins || {};

  return {
    url: process.env.JENKINS_URL || jenkinsConfig.url || "",
    user: process.env.JENKINS_USER || jenkinsConfig.user || "",
    token: process.env.JENKINS_TOKEN || jenkinsConfig.token || "",
  };
}

/**
 * Validate configuration
 */
function validateConfig(config: JenkinsConfig): void {
  const missing: string[] = [];

  if (!config.url) missing.push("url (JENKINS_URL or config.jenkins.url)");
  if (!config.user) missing.push("user (JENKINS_USER or config.jenkins.user)");
  if (!config.token) missing.push("token (JENKINS_TOKEN or config.jenkins.token)");

  if (missing.length > 0) {
    console.error(`Error: Missing required configuration: ${missing.join(", ")}`);
    console.error(`
Jenkins MCP Server Configuration:

Option 1: Create mcp-servers/config.json:
  {
    "jenkins": {
      "url": "http://localhost:9001",
      "user": "admin",
      "token": "your-api-token"
    }
  }

Option 2: Use environment variables:
  JENKINS_URL=http://localhost:9001 \\
  JENKINS_USER=admin \\
  JENKINS_TOKEN=your-api-token \\
  node dist/index.js

To generate a Jenkins API token:
  1. Log into Jenkins
  2. Click your username → Configure
  3. Add new API Token
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

  // Create Jenkins client
  const jenkinsClient = new JenkinsClient(config);

  // Create MCP server
  const server = new Server(
    {
      name: "jenkins-mcp-server",
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

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = toolHandlers[name];

    if (!handler) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await handler(jenkinsClient, args || {});
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        content: [
          {
            type: "text" as const,
            text: `Error executing ${name}: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Connect transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup (to stderr so it doesn't interfere with MCP protocol on stdout)
  console.error(`Jenkins MCP Server started`);
  console.error(`Connected to: ${config.url}`);
}

// Run the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
