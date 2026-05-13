/**
 * MCP Tool Definitions for GitLab
 *
 * Defines all available tools with their schemas.
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const TOOLS: Tool[] = [
  {
    name: "gitlab_health_check",
    description:
      "Check if GitLab server is accessible and get current user information.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "gitlab_list_projects",
    description:
      "List GitLab projects. Can filter by ownership, membership, or search term.",
    inputSchema: {
      type: "object" as const,
      properties: {
        owned: {
          type: "boolean",
          description: "Only list projects owned by the current user",
        },
        membership: {
          type: "boolean",
          description: "Only list projects where current user is a member",
        },
        search: {
          type: "string",
          description: "Search term to filter projects by name",
        },
        page: {
          type: "number",
          description: "Page number (default: 1)",
        },
        per_page: {
          type: "number",
          description: "Number of results per page (default: 20, max: 100)",
        },
      },
      required: [],
    },
  },
  {
    name: "gitlab_get_project",
    description:
      "Get detailed information about a specific GitLab project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description:
            "Project ID (number) or path (e.g., 'group/project-name')",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "gitlab_list_branches",
    description: "List branches in a GitLab project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Project ID or path",
        },
        search: {
          type: "string",
          description: "Search term to filter branches",
        },
        page: {
          type: "number",
          description: "Page number",
        },
        per_page: {
          type: "number",
          description: "Number of results per page",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "gitlab_create_branch",
    description: "Create a new branch in a GitLab project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Project ID or path",
        },
        branch_name: {
          type: "string",
          description: "Name for the new branch",
        },
        ref: {
          type: "string",
          description:
            "Source branch, tag, or commit SHA to create the branch from",
        },
      },
      required: ["project_id", "branch_name", "ref"],
    },
  },
  {
    name: "gitlab_list_merge_requests",
    description:
      "List merge requests in a GitLab project. Filter by state (opened, closed, merged, all).",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Project ID or path",
        },
        state: {
          type: "string",
          enum: ["opened", "closed", "merged", "all"],
          description: "Filter by MR state (default: all)",
        },
        page: {
          type: "number",
          description: "Page number",
        },
        per_page: {
          type: "number",
          description: "Number of results per page",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "gitlab_get_merge_request",
    description: "Get detailed information about a specific merge request.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Project ID or path",
        },
        mr_iid: {
          type: "number",
          description: "Merge request IID (internal ID within the project)",
        },
      },
      required: ["project_id", "mr_iid"],
    },
  },
  {
    name: "gitlab_create_merge_request",
    description: "Create a new merge request in a GitLab project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Project ID or path",
        },
        source_branch: {
          type: "string",
          description: "Source branch name",
        },
        target_branch: {
          type: "string",
          description: "Target branch name",
        },
        title: {
          type: "string",
          description: "Title of the merge request",
        },
        description: {
          type: "string",
          description: "Description of the merge request",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Labels to apply to the MR",
        },
      },
      required: ["project_id", "source_branch", "target_branch", "title"],
    },
  },
  {
    name: "gitlab_list_issues",
    description:
      "List issues in a GitLab project. Filter by state and labels.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Project ID or path",
        },
        state: {
          type: "string",
          enum: ["opened", "closed", "all"],
          description: "Filter by issue state (default: all)",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Filter by labels",
        },
        page: {
          type: "number",
          description: "Page number",
        },
        per_page: {
          type: "number",
          description: "Number of results per page",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "gitlab_create_issue",
    description: "Create a new issue in a GitLab project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Project ID or path",
        },
        title: {
          type: "string",
          description: "Title of the issue",
        },
        description: {
          type: "string",
          description: "Description of the issue",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Labels to apply",
        },
      },
      required: ["project_id", "title"],
    },
  },
  {
    name: "gitlab_list_pipelines",
    description:
      "List CI/CD pipelines for a GitLab project. Filter by status and ref.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Project ID or path",
        },
        status: {
          type: "string",
          enum: [
            "running",
            "pending",
            "success",
            "failed",
            "canceled",
            "skipped",
          ],
          description: "Filter by pipeline status",
        },
        ref: {
          type: "string",
          description: "Filter by branch or tag name",
        },
        page: {
          type: "number",
          description: "Page number",
        },
        per_page: {
          type: "number",
          description: "Number of results per page",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "gitlab_get_pipeline",
    description:
      "Get detailed information about a specific pipeline including its jobs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Project ID or path",
        },
        pipeline_id: {
          type: "number",
          description: "Pipeline ID",
        },
      },
      required: ["project_id", "pipeline_id"],
    },
  },
  {
    name: "gitlab_trigger_pipeline",
    description: "Trigger a new pipeline for a branch or tag.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Project ID or path",
        },
        ref: {
          type: "string",
          description: "Branch or tag name to run the pipeline for",
        },
        variables: {
          type: "object",
          description:
            "Pipeline variables as key-value pairs (e.g., {\"DEPLOY_ENV\": \"staging\"})",
          additionalProperties: { type: "string" },
        },
      },
      required: ["project_id", "ref"],
    },
  },
  {
    name: "gitlab_cancel_pipeline",
    description: "Cancel a running pipeline.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Project ID or path",
        },
        pipeline_id: {
          type: "number",
          description: "Pipeline ID to cancel",
        },
      },
      required: ["project_id", "pipeline_id"],
    },
  },
  {
    name: "gitlab_retry_pipeline",
    description: "Retry a failed pipeline.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Project ID or path",
        },
        pipeline_id: {
          type: "number",
          description: "Pipeline ID to retry",
        },
      },
      required: ["project_id", "pipeline_id"],
    },
  },
  {
    name: "gitlab_get_job_log",
    description: "Get the log output of a CI/CD job.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Project ID or path",
        },
        job_id: {
          type: "number",
          description: "Job ID",
        },
      },
      required: ["project_id", "job_id"],
    },
  },
  {
    name: "gitlab_list_commits",
    description: "List commits in a GitLab project repository.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Project ID or path",
        },
        ref_name: {
          type: "string",
          description: "Branch or tag name (default: default branch)",
        },
        page: {
          type: "number",
          description: "Page number",
        },
        per_page: {
          type: "number",
          description: "Number of results per page",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "gitlab_get_file",
    description: "Get the content of a file from the repository.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Project ID or path",
        },
        file_path: {
          type: "string",
          description: "Path to the file in the repository",
        },
        ref: {
          type: "string",
          description: "Branch, tag, or commit SHA (default: main)",
        },
      },
      required: ["project_id", "file_path"],
    },
  },
  {
    name: "gitlab_list_tree",
    description: "List files and directories in a repository.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Project ID or path",
        },
        path: {
          type: "string",
          description: "Path inside the repository (default: root)",
        },
        ref: {
          type: "string",
          description: "Branch, tag, or commit SHA",
        },
        recursive: {
          type: "boolean",
          description: "Get tree recursively (default: false)",
        },
        page: {
          type: "number",
          description: "Page number",
        },
        per_page: {
          type: "number",
          description: "Number of results per page",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "gitlab_compare",
    description: "Compare two branches, tags, or commits.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Project ID or path",
        },
        from: {
          type: "string",
          description: "Source branch, tag, or commit SHA",
        },
        to: {
          type: "string",
          description: "Target branch, tag, or commit SHA",
        },
      },
      required: ["project_id", "from", "to"],
    },
  },
];
