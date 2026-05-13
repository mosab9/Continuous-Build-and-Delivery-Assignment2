#!/usr/bin/env node

/**
 * SonarQube MCP Server
 *
 * An MCP server that provides tools for interacting with SonarQube code quality analysis.
 *
 * Configuration (in order of precedence):
 *   1. Environment variables: SONAR_URL, SONAR_TOKEN
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
import { SonarQubeClient } from "./sonarqube-client.js";
import { TOOLS } from "./tools/definitions.js";
import { toolHandlers } from "./tools/handlers.js";

/**
 * SonarQube configuration interface
 */
interface SonarQubeConfig {
  url: string;
  token: string;
}

/**
 * Find and load the central config file
 */
function loadCentralConfig(): { sonarqube?: SonarQubeConfig } {
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
function getConfig(): SonarQubeConfig {
  const centralConfig = loadCentralConfig();
  const sonarConfig: Partial<SonarQubeConfig> = centralConfig.sonarqube || {};

  return {
    url: process.env.SONAR_URL || sonarConfig.url || "",
    token: process.env.SONAR_TOKEN || sonarConfig.token || "",
  };
}

/**
 * Validate configuration
 */
function validateConfig(config: SonarQubeConfig): void {
  const missing: string[] = [];

  if (!config.url) missing.push("url (SONAR_URL or config.sonarqube.url)");
  if (!config.token) missing.push("token (SONAR_TOKEN or config.sonarqube.token)");

  if (missing.length > 0) {
    console.error(`Error: Missing required configuration: ${missing.join(", ")}`);
    console.error(`
SonarQube MCP Server Configuration:

Option 1: Create mcp-servers/config.json:
  {
    "sonarqube": {
      "url": "http://localhost:9000",
      "token": "sqa_your-token-here"
    }
  }

Option 2: Use environment variables:
  SONAR_URL=http://localhost:9000 \\
  SONAR_TOKEN=sqa_your-token \\
  node dist/index.js

To generate a SonarQube API token:
  1. Log into SonarQube
  2. Go to My Account → Security
  3. Generate a new token
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

  // Create SonarQube client
  const sonarClient = new SonarQubeClient(config);

  // Create MCP server
  const server = new Server(
    {
      name: "sonarqube-mcp-server",
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
      const result = await handler(sonarClient, args || {});
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
  console.error(`SonarQube MCP Server started`);
  console.error(`Connected to: ${config.url}`);
}

// Run the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
