/**
 * MCP Tool Definitions for Jenkins
 *
 * Defines all available tools with their schemas.
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const TOOLS: Tool[] = [
  {
    name: "jenkins_list_jobs",
    description:
      "List all Jenkins jobs. Optionally filter by folder. Returns job names, URLs, and current status (color indicates build state).",
    inputSchema: {
      type: "object" as const,
      properties: {
        folder: {
          type: "string",
          description:
            "Optional folder path to list jobs from (e.g., 'my-folder' or 'parent/child')",
        },
      },
      required: [],
    },
  },
  {
    name: "jenkins_get_job",
    description:
      "Get detailed information about a specific Jenkins job including build history, last build status, and next build number.",
    inputSchema: {
      type: "object" as const,
      properties: {
        job_name: {
          type: "string",
          description:
            "Name of the job (use '/' for jobs in folders, e.g., 'folder/job-name')",
        },
      },
      required: ["job_name"],
    },
  },
  {
    name: "jenkins_trigger_build",
    description:
      "Trigger a new build for a Jenkins job. Supports parameterized builds. Returns queue ID and optionally waits for build to start.",
    inputSchema: {
      type: "object" as const,
      properties: {
        job_name: {
          type: "string",
          description:
            "Name of the job to build (use '/' for jobs in folders)",
        },
        parameters: {
          type: "object",
          description:
            "Optional build parameters as key-value pairs (e.g., {\"BRANCH\": \"main\", \"ENV\": \"staging\"})",
          additionalProperties: {
            type: "string",
          },
        },
        wait_for_start: {
          type: "boolean",
          description:
            "If true, wait for the build to start and return the build number (default: false)",
        },
      },
      required: ["job_name"],
    },
  },
  {
    name: "jenkins_get_build",
    description:
      "Get detailed information about a specific build including status, duration, parameters, and result.",
    inputSchema: {
      type: "object" as const,
      properties: {
        job_name: {
          type: "string",
          description: "Name of the job",
        },
        build_number: {
          type: "number",
          description:
            "Build number to get info for. Use -1 for latest build.",
        },
      },
      required: ["job_name", "build_number"],
    },
  },
  {
    name: "jenkins_get_build_log",
    description:
      "Get the console output (log) of a Jenkins build. Supports fetching partial logs for long outputs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        job_name: {
          type: "string",
          description: "Name of the job",
        },
        build_number: {
          type: "number",
          description: "Build number. Use -1 for latest build.",
        },
        start: {
          type: "number",
          description:
            "Optional byte offset to start reading from (for pagination)",
        },
        max_lines: {
          type: "number",
          description:
            "Optional maximum number of lines to return (default: 1000)",
        },
      },
      required: ["job_name", "build_number"],
    },
  },
  {
    name: "jenkins_abort_build",
    description: "Abort/stop a running Jenkins build.",
    inputSchema: {
      type: "object" as const,
      properties: {
        job_name: {
          type: "string",
          description: "Name of the job",
        },
        build_number: {
          type: "number",
          description: "Build number to abort. Use -1 for latest build.",
        },
      },
      required: ["job_name", "build_number"],
    },
  },
  {
    name: "jenkins_get_job_config",
    description:
      "Get the XML configuration of a Jenkins job. Useful for understanding job setup and pipeline definition.",
    inputSchema: {
      type: "object" as const,
      properties: {
        job_name: {
          type: "string",
          description: "Name of the job",
        },
      },
      required: ["job_name"],
    },
  },
  {
    name: "jenkins_get_test_results",
    description:
      "Get test results for a Jenkins build including pass/fail counts and test case details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        job_name: {
          type: "string",
          description: "Name of the job",
        },
        build_number: {
          type: "number",
          description: "Build number. Use -1 for latest build.",
        },
      },
      required: ["job_name", "build_number"],
    },
  },
  {
    name: "jenkins_get_queue",
    description:
      "Get information about a queued build item. Useful for tracking builds waiting to execute.",
    inputSchema: {
      type: "object" as const,
      properties: {
        queue_id: {
          type: "number",
          description: "Queue item ID returned from trigger_build",
        },
      },
      required: ["queue_id"],
    },
  },
  {
    name: "jenkins_health_check",
    description:
      "Check if Jenkins server is accessible and responding. Returns server information if healthy.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];
