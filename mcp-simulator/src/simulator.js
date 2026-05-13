import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import readline from "readline";

/**
 * MCP Server Simulator
 *
 * This simulator acts as an MCP client to test your MCP servers
 * without needing Claude Desktop.
 */
class MCPSimulator {
  constructor() {
    this.client = null;
    this.transport = null;
    this.serverProcess = null;
    this.tools = [];
  }

  /**
   * Connect to an MCP server
   * @param {string} command - Command to run (e.g., 'node')
   * @param {string[]} args - Arguments (e.g., ['path/to/server.js'])
   * @param {object} env - Environment variables
   */
  async connect(command, args, env = {}) {
    console.log(`\n🔌 Connecting to MCP server...`);
    console.log(`   Command: ${command} ${args.join(" ")}`);

    // Create transport that spawns the server process
    this.transport = new StdioClientTransport({
      command,
      args,
      env: { ...process.env, ...env },
    });

    // Create client
    this.client = new Client(
      {
        name: "mcp-simulator",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    // Connect
    await this.client.connect(this.transport);
    console.log(`✅ Connected successfully!\n`);

    // Get server info
    const serverInfo = this.client.getServerVersion();
    console.log(`📡 Server: ${serverInfo?.name || "Unknown"} v${serverInfo?.version || "?"}`);
  }

  /**
   * List all available tools from the server
   */
  async listTools() {
    console.log("\n📋 Fetching available tools...\n");

    const result = await this.client.listTools();
    this.tools = result.tools || [];

    if (this.tools.length === 0) {
      console.log("   No tools available.");
      return;
    }

    console.log("Available Tools:");
    console.log("─".repeat(60));

    this.tools.forEach((tool, index) => {
      console.log(`\n${index + 1}. ${tool.name}`);
      console.log(`   Description: ${tool.description || "No description"}`);
      if (tool.inputSchema?.properties) {
        console.log(`   Parameters:`);
        Object.entries(tool.inputSchema.properties).forEach(([name, schema]) => {
          const required = tool.inputSchema.required?.includes(name) ? "*" : "";
          console.log(`     - ${name}${required}: ${schema.type} - ${schema.description || ""}`);
        });
      }
    });

    console.log("\n" + "─".repeat(60));
    return this.tools;
  }

  /**
   * Call a tool with given arguments
   * @param {string} toolName - Name of the tool to call
   * @param {object} args - Arguments to pass to the tool
   */
  async callTool(toolName, args = {}) {
    console.log(`\n🔧 Calling tool: ${toolName}`);
    console.log(`   Arguments: ${JSON.stringify(args, null, 2)}`);

    try {
      const result = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      console.log(`\n✅ Result:`);
      console.log("─".repeat(40));

      if (result.content) {
        result.content.forEach((item) => {
          if (item.type === "text") {
            console.log(item.text);
          } else {
            console.log(JSON.stringify(item, null, 2));
          }
        });
      }

      console.log("─".repeat(40));
      return result;
    } catch (error) {
      console.error(`\n❌ Error calling tool: ${error.message}`);
      throw error;
    }
  }

  /**
   * List available resources
   */
  async listResources() {
    console.log("\n📁 Fetching available resources...\n");

    try {
      const result = await this.client.listResources();
      const resources = result.resources || [];

      if (resources.length === 0) {
        console.log("   No resources available.");
        return;
      }

      console.log("Available Resources:");
      console.log("─".repeat(60));

      resources.forEach((resource, index) => {
        console.log(`\n${index + 1}. ${resource.uri}`);
        console.log(`   Name: ${resource.name || "N/A"}`);
        console.log(`   MIME Type: ${resource.mimeType || "N/A"}`);
        if (resource.description) {
          console.log(`   Description: ${resource.description}`);
        }
      });

      console.log("\n" + "─".repeat(60));
      return resources;
    } catch (error) {
      console.log("   Resources not supported by this server.");
      return [];
    }
  }

  /**
   * Read a specific resource
   * @param {string} uri - Resource URI to read
   */
  async readResource(uri) {
    console.log(`\n📖 Reading resource: ${uri}`);

    try {
      const result = await this.client.readResource({ uri });
      console.log(`\n✅ Content:`);
      console.log("─".repeat(40));
      console.log(JSON.stringify(result, null, 2));
      console.log("─".repeat(40));
      return result;
    } catch (error) {
      console.error(`\n❌ Error reading resource: ${error.message}`);
      throw error;
    }
  }

  /**
   * Disconnect from the server
   */
  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log("\n👋 Disconnected from server.");
    }
  }

  /**
   * Run interactive mode
   */
  async interactive() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = () => {
      rl.question("\nmcp> ", async (input) => {
        const [command, ...args] = input.trim().split(" ");

        try {
          switch (command) {
            case "tools":
              await this.listTools();
              break;

            case "resources":
              await this.listResources();
              break;

            case "call":
              if (args.length < 1) {
                console.log("Usage: call <tool_name> [json_args]");
                break;
              }
              const toolName = args[0];
              const toolArgs = args.slice(1).join(" ");
              const parsedArgs = toolArgs ? JSON.parse(toolArgs) : {};
              await this.callTool(toolName, parsedArgs);
              break;

            case "read":
              if (args.length < 1) {
                console.log("Usage: read <resource_uri>");
                break;
              }
              await this.readResource(args[0]);
              break;

            case "help":
              console.log(`
Available Commands:
  tools              - List all available tools
  resources          - List all available resources
  call <name> [args] - Call a tool (args as JSON)
  read <uri>         - Read a resource
  help               - Show this help
  exit               - Exit simulator

Examples:
  call jenkins_trigger_build {"job_name": "my-job"}
  call sonar_get_metrics {"project_key": "my-project"}
              `);
              break;

            case "exit":
            case "quit":
              await this.disconnect();
              rl.close();
              process.exit(0);

            default:
              if (command) {
                console.log(`Unknown command: ${command}. Type 'help' for available commands.`);
              }
          }
        } catch (error) {
          console.error(`Error: ${error.message}`);
        }

        prompt();
      });
    };

    console.log("\n🎮 Interactive Mode - Type 'help' for commands\n");
    prompt();
  }
}

// Main execution
async function main() {
  const simulator = new MCPSimulator();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const serverArg = args.find((a) => a.startsWith("--server="));
  const serverType = serverArg?.split("=")[1] || args[args.indexOf("--server") + 1];

  // Server configurations
  const servers = {
    jenkins: {
      command: "node",
      args: ["../mcp-servers/jenkins-mcp-server/dist/index.js"],
      env: {
        JENKINS_URL: process.env.JENKINS_URL || "http://localhost:8080",
        JENKINS_USER: process.env.JENKINS_USER || "admin",
        JENKINS_TOKEN: process.env.JENKINS_TOKEN || "your-token",
      },
    },
    sonar: {
      command: "node",
      args: ["../mcp-servers/sonarqube-mcp-server/dist/index.js"],
      env: {
        SONAR_URL: process.env.SONAR_URL || "http://localhost:9000",
        SONAR_TOKEN: process.env.SONAR_TOKEN || "your-token",
      },
    },
  };

  // If a specific server is requested
  if (serverType && servers[serverType]) {
    const config = servers[serverType];
    try {
      await simulator.connect(config.command, config.args, config.env);
      await simulator.listTools();
      await simulator.interactive();
    } catch (error) {
      console.error(`Failed to connect: ${error.message}`);
      console.log("\nMake sure your MCP server is built and the path is correct.");
      process.exit(1);
    }
  } else {
    // Show usage
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║              MCP Server Simulator                         ║
╠═══════════════════════════════════════════════════════════╣
║  Test your MCP servers without Claude Desktop             ║
╚═══════════════════════════════════════════════════════════╝

Usage:
  node src/simulator.js --server <name>

Available servers:
  - jenkins    Test Jenkins MCP server
  - sonar      Test SonarQube MCP server

Examples:
  npm run test:jenkins
  npm run test:sonar

Environment Variables:
  JENKINS_URL    Jenkins server URL (default: http://localhost:8080)
  JENKINS_USER   Jenkins username (default: admin)
  JENKINS_TOKEN  Jenkins API token

  SONAR_URL      SonarQube server URL (default: http://localhost:9000)
  SONAR_TOKEN    SonarQube API token

Or connect to a custom server:

  import { MCPSimulator } from './simulator.js';

  const sim = new MCPSimulator();
  await sim.connect('node', ['path/to/server.js'], { ENV_VAR: 'value' });
  await sim.listTools();
  await sim.callTool('tool_name', { arg: 'value' });
    `);
  }
}

main().catch(console.error);

export { MCPSimulator };
