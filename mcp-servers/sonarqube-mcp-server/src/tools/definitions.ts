/**
 * MCP Tool Definitions for SonarQube
 *
 * Defines all available tools with their schemas.
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const TOOLS: Tool[] = [
  {
    name: "sonar_health_check",
    description:
      "Check if SonarQube server is accessible and get server version information.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "sonar_list_projects",
    description:
      "List all projects in SonarQube. Supports pagination and search by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Optional search query to filter projects by name",
        },
        page: {
          type: "number",
          description: "Page number (default: 1)",
        },
        page_size: {
          type: "number",
          description: "Number of results per page (default: 50, max: 500)",
        },
      },
      required: [],
    },
  },
  {
    name: "sonar_get_quality_gate",
    description:
      "Get the quality gate status for a project. Shows if the project passes or fails quality checks and which conditions are not met.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_key: {
          type: "string",
          description: "The unique key of the project",
        },
      },
      required: ["project_key"],
    },
  },
  {
    name: "sonar_get_metrics",
    description:
      "Get code quality metrics for a project including coverage, bugs, vulnerabilities, code smells, and more.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_key: {
          type: "string",
          description: "The unique key of the project",
        },
        metrics: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional list of specific metrics to retrieve. If not provided, returns common metrics (coverage, bugs, vulnerabilities, code_smells, duplicated_lines_density, ncloc, security_hotspots)",
        },
      },
      required: ["project_key"],
    },
  },
  {
    name: "sonar_get_issues",
    description:
      "Get code issues (bugs, vulnerabilities, code smells) for a project. Supports filtering by severity and type.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_key: {
          type: "string",
          description: "The unique key of the project",
        },
        severities: {
          type: "array",
          items: { type: "string" },
          description:
            "Filter by severity: BLOCKER, CRITICAL, MAJOR, MINOR, INFO",
        },
        types: {
          type: "array",
          items: { type: "string" },
          description: "Filter by type: BUG, VULNERABILITY, CODE_SMELL",
        },
        resolved: {
          type: "boolean",
          description:
            "If true, show resolved issues. If false, show open issues only (default: false)",
        },
        page: {
          type: "number",
          description: "Page number (default: 1)",
        },
        page_size: {
          type: "number",
          description: "Number of results per page (default: 20, max: 500)",
        },
      },
      required: ["project_key"],
    },
  },
  {
    name: "sonar_get_hotspots",
    description:
      "Get security hotspots for a project. Hotspots are security-sensitive code that needs review.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_key: {
          type: "string",
          description: "The unique key of the project",
        },
        status: {
          type: "string",
          description:
            "Filter by status: TO_REVIEW, REVIEWED (default: TO_REVIEW)",
        },
        page: {
          type: "number",
          description: "Page number (default: 1)",
        },
        page_size: {
          type: "number",
          description: "Number of results per page (default: 20, max: 500)",
        },
      },
      required: ["project_key"],
    },
  },
  {
    name: "sonar_get_coverage",
    description:
      "Get code coverage information for a project including line coverage, branch coverage, and uncovered lines.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_key: {
          type: "string",
          description: "The unique key of the project",
        },
      },
      required: ["project_key"],
    },
  },
  {
    name: "sonar_get_duplications",
    description:
      "Get code duplication information for a specific file/component.",
    inputSchema: {
      type: "object" as const,
      properties: {
        component_key: {
          type: "string",
          description:
            "The component key (usually project_key:path/to/file.ext)",
        },
      },
      required: ["component_key"],
    },
  },
  {
    name: "sonar_get_source",
    description:
      "Get source code for a file with optional line range. Useful for viewing code around issues.",
    inputSchema: {
      type: "object" as const,
      properties: {
        component_key: {
          type: "string",
          description:
            "The component key (usually project_key:path/to/file.ext)",
        },
        from_line: {
          type: "number",
          description: "Starting line number (default: 1)",
        },
        to_line: {
          type: "number",
          description: "Ending line number (default: end of file)",
        },
      },
      required: ["component_key"],
    },
  },
  {
    name: "sonar_get_analysis_history",
    description:
      "Get analysis history for a project showing past analyses and quality gate changes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_key: {
          type: "string",
          description: "The unique key of the project",
        },
        page: {
          type: "number",
          description: "Page number (default: 1)",
        },
        page_size: {
          type: "number",
          description: "Number of results per page (default: 10)",
        },
      },
      required: ["project_key"],
    },
  },
  {
    name: "sonar_get_tasks",
    description:
      "Get background analysis tasks. Shows pending, in-progress, and completed analyses.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_key: {
          type: "string",
          description: "Optional project key to filter tasks",
        },
        status: {
          type: "string",
          description:
            "Filter by status: PENDING, IN_PROGRESS, SUCCESS, FAILED, CANCELED",
        },
        page: {
          type: "number",
          description: "Page number (default: 1)",
        },
        page_size: {
          type: "number",
          description: "Number of results per page (default: 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "sonar_get_quality_gates",
    description: "List all quality gates configured in SonarQube.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "sonar_get_rules",
    description:
      "Search for analysis rules. Useful for understanding what rules are active and their severity.",
    inputSchema: {
      type: "object" as const,
      properties: {
        languages: {
          type: "array",
          items: { type: "string" },
          description: "Filter by language (e.g., java, javascript, python)",
        },
        severities: {
          type: "array",
          items: { type: "string" },
          description:
            "Filter by severity: BLOCKER, CRITICAL, MAJOR, MINOR, INFO",
        },
        types: {
          type: "array",
          items: { type: "string" },
          description: "Filter by type: BUG, VULNERABILITY, CODE_SMELL",
        },
        page: {
          type: "number",
          description: "Page number (default: 1)",
        },
        page_size: {
          type: "number",
          description: "Number of results per page (default: 25)",
        },
      },
      required: [],
    },
  },
];
