/**
 * MCP Tool Handlers for GitLab
 *
 * Implements all tool handlers that execute GitLab API operations.
 */

import { GitLabClient } from "../gitlab-client.js";

interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

function success(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function error(message: string): ToolResult {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

export async function handleToolCall(
  client: GitLabClient,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "gitlab_health_check":
        return await handleHealthCheck(client);

      case "gitlab_list_projects":
        return await handleListProjects(client, args);

      case "gitlab_get_project":
        return await handleGetProject(client, args);

      case "gitlab_list_branches":
        return await handleListBranches(client, args);

      case "gitlab_create_branch":
        return await handleCreateBranch(client, args);

      case "gitlab_list_merge_requests":
        return await handleListMergeRequests(client, args);

      case "gitlab_get_merge_request":
        return await handleGetMergeRequest(client, args);

      case "gitlab_create_merge_request":
        return await handleCreateMergeRequest(client, args);

      case "gitlab_list_issues":
        return await handleListIssues(client, args);

      case "gitlab_create_issue":
        return await handleCreateIssue(client, args);

      case "gitlab_list_pipelines":
        return await handleListPipelines(client, args);

      case "gitlab_get_pipeline":
        return await handleGetPipeline(client, args);

      case "gitlab_trigger_pipeline":
        return await handleTriggerPipeline(client, args);

      case "gitlab_cancel_pipeline":
        return await handleCancelPipeline(client, args);

      case "gitlab_retry_pipeline":
        return await handleRetryPipeline(client, args);

      case "gitlab_get_job_log":
        return await handleGetJobLog(client, args);

      case "gitlab_list_commits":
        return await handleListCommits(client, args);

      case "gitlab_get_file":
        return await handleGetFile(client, args);

      case "gitlab_list_tree":
        return await handleListTree(client, args);

      case "gitlab_compare":
        return await handleCompare(client, args);

      default:
        return error(`Unknown tool: ${toolName}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return error(message);
  }
}

// Health Check
async function handleHealthCheck(client: GitLabClient): Promise<ToolResult> {
  const user = await client.getCurrentUser();
  return success({
    status: "connected",
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      state: user.state,
    },
    message: "Successfully connected to GitLab",
  });
}

// Projects
async function handleListProjects(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projects = await client.listProjects({
    owned: args.owned as boolean | undefined,
    membership: args.membership as boolean | undefined,
    search: args.search as string | undefined,
    page: args.page as number | undefined,
    perPage: args.per_page as number | undefined,
  });

  return success({
    count: projects.length,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      path_with_namespace: p.path_with_namespace,
      description: p.description,
      default_branch: p.default_branch,
      visibility: p.visibility,
      web_url: p.web_url,
      last_activity_at: p.last_activity_at,
    })),
  });
}

async function handleGetProject(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  if (!projectId) {
    return error("project_id is required");
  }

  const project = await client.getProject(projectId);
  return success({
    id: project.id,
    name: project.name,
    path_with_namespace: project.path_with_namespace,
    description: project.description,
    default_branch: project.default_branch,
    visibility: project.visibility,
    web_url: project.web_url,
    ssh_url_to_repo: project.ssh_url_to_repo,
    http_url_to_repo: project.http_url_to_repo,
    created_at: project.created_at,
    last_activity_at: project.last_activity_at,
    forks_count: project.forks_count,
    star_count: project.star_count,
    open_issues_count: project.open_issues_count,
  });
}

// Branches
async function handleListBranches(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  if (!projectId) {
    return error("project_id is required");
  }

  const branches = await client.listBranches(projectId, {
    search: args.search as string | undefined,
    page: args.page as number | undefined,
    perPage: args.per_page as number | undefined,
  });

  return success({
    count: branches.length,
    branches: branches.map((b) => ({
      name: b.name,
      protected: b.protected,
      default: b.default,
      web_url: b.web_url,
      commit: {
        id: b.commit.id,
        short_id: b.commit.short_id,
        title: b.commit.title,
        author_name: b.commit.author_name,
        authored_date: b.commit.authored_date,
      },
    })),
  });
}

async function handleCreateBranch(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  const branchName = args.branch_name as string;
  const ref = args.ref as string;

  if (!projectId || !branchName || !ref) {
    return error("project_id, branch_name, and ref are required");
  }

  const branch = await client.createBranch(projectId, branchName, ref);
  return success({
    message: `Branch '${branch.name}' created successfully`,
    branch: {
      name: branch.name,
      protected: branch.protected,
      web_url: branch.web_url,
      commit: {
        id: branch.commit.id,
        short_id: branch.commit.short_id,
        title: branch.commit.title,
      },
    },
  });
}

// Merge Requests
async function handleListMergeRequests(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  if (!projectId) {
    return error("project_id is required");
  }

  const mergeRequests = await client.listMergeRequests(projectId, {
    state: args.state as "opened" | "closed" | "merged" | "all" | undefined,
    page: args.page as number | undefined,
    perPage: args.per_page as number | undefined,
  });

  return success({
    count: mergeRequests.length,
    merge_requests: mergeRequests.map((mr) => ({
      iid: mr.iid,
      title: mr.title,
      state: mr.state,
      source_branch: mr.source_branch,
      target_branch: mr.target_branch,
      author: mr.author.username,
      web_url: mr.web_url,
      created_at: mr.created_at,
      updated_at: mr.updated_at,
      merged_at: mr.merged_at,
      labels: mr.labels,
    })),
  });
}

async function handleGetMergeRequest(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  const mrIid = args.mr_iid as number;

  if (!projectId || mrIid === undefined) {
    return error("project_id and mr_iid are required");
  }

  const mr = await client.getMergeRequest(projectId, mrIid);
  return success({
    iid: mr.iid,
    title: mr.title,
    description: mr.description,
    state: mr.state,
    source_branch: mr.source_branch,
    target_branch: mr.target_branch,
    author: {
      username: mr.author.username,
      name: mr.author.name,
    },
    assignee: mr.assignee
      ? {
          username: mr.assignee.username,
          name: mr.assignee.name,
        }
      : null,
    web_url: mr.web_url,
    created_at: mr.created_at,
    updated_at: mr.updated_at,
    merged_at: mr.merged_at,
    labels: mr.labels,
    merge_status: mr.merge_status,
  });
}

async function handleCreateMergeRequest(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  const sourceBranch = args.source_branch as string;
  const targetBranch = args.target_branch as string;
  const title = args.title as string;

  if (!projectId || !sourceBranch || !targetBranch || !title) {
    return error(
      "project_id, source_branch, target_branch, and title are required"
    );
  }

  const mr = await client.createMergeRequest(projectId, {
    sourceBranch,
    targetBranch,
    title,
    description: args.description as string | undefined,
    labels: args.labels as string[] | undefined,
  });

  return success({
    message: `Merge request created successfully`,
    merge_request: {
      iid: mr.iid,
      title: mr.title,
      state: mr.state,
      source_branch: mr.source_branch,
      target_branch: mr.target_branch,
      web_url: mr.web_url,
    },
  });
}

// Issues
async function handleListIssues(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  if (!projectId) {
    return error("project_id is required");
  }

  const issues = await client.listIssues(projectId, {
    state: args.state as "opened" | "closed" | "all" | undefined,
    labels: args.labels as string[] | undefined,
    page: args.page as number | undefined,
    perPage: args.per_page as number | undefined,
  });

  return success({
    count: issues.length,
    issues: issues.map((issue) => ({
      iid: issue.iid,
      title: issue.title,
      state: issue.state,
      author: issue.author.username,
      assignees: issue.assignees?.map((a) => a.username) || [],
      labels: issue.labels,
      web_url: issue.web_url,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      closed_at: issue.closed_at,
    })),
  });
}

async function handleCreateIssue(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  const title = args.title as string;

  if (!projectId || !title) {
    return error("project_id and title are required");
  }

  const issue = await client.createIssue(projectId, {
    title,
    description: args.description as string | undefined,
    labels: args.labels as string[] | undefined,
  });

  return success({
    message: `Issue created successfully`,
    issue: {
      iid: issue.iid,
      title: issue.title,
      state: issue.state,
      web_url: issue.web_url,
      labels: issue.labels,
    },
  });
}

// Pipelines
async function handleListPipelines(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  if (!projectId) {
    return error("project_id is required");
  }

  const pipelines = await client.listPipelines(projectId, {
    status: args.status as string | undefined,
    ref: args.ref as string | undefined,
    page: args.page as number | undefined,
    perPage: args.per_page as number | undefined,
  });

  return success({
    count: pipelines.length,
    pipelines: pipelines.map((p) => ({
      id: p.id,
      status: p.status,
      ref: p.ref,
      sha: p.sha?.substring(0, 8),
      web_url: p.web_url,
      created_at: p.created_at,
      updated_at: p.updated_at,
    })),
  });
}

async function handleGetPipeline(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  const pipelineId = args.pipeline_id as number;

  if (!projectId || pipelineId === undefined) {
    return error("project_id and pipeline_id are required");
  }

  const [pipeline, jobs] = await Promise.all([
    client.getPipeline(projectId, pipelineId),
    client.getPipelineJobs(projectId, pipelineId),
  ]);

  return success({
    id: pipeline.id,
    status: pipeline.status,
    ref: pipeline.ref,
    sha: pipeline.sha,
    web_url: pipeline.web_url,
    created_at: pipeline.created_at,
    started_at: pipeline.started_at,
    finished_at: pipeline.finished_at,
    duration: pipeline.duration,
    jobs: jobs.map((j) => ({
      id: j.id,
      name: j.name,
      stage: j.stage,
      status: j.status,
      started_at: j.started_at,
      finished_at: j.finished_at,
      duration: j.duration,
      web_url: j.web_url,
    })),
  });
}

async function handleTriggerPipeline(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  const ref = args.ref as string;

  if (!projectId || !ref) {
    return error("project_id and ref are required");
  }

  const pipeline = await client.triggerPipeline(
    projectId,
    ref,
    args.variables as Record<string, string> | undefined
  );

  return success({
    message: `Pipeline triggered successfully`,
    pipeline: {
      id: pipeline.id,
      status: pipeline.status,
      ref: pipeline.ref,
      web_url: pipeline.web_url,
    },
  });
}

async function handleCancelPipeline(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  const pipelineId = args.pipeline_id as number;

  if (!projectId || pipelineId === undefined) {
    return error("project_id and pipeline_id are required");
  }

  const pipeline = await client.cancelPipeline(projectId, pipelineId);
  return success({
    message: `Pipeline ${pipelineId} cancelled`,
    pipeline: {
      id: pipeline.id,
      status: pipeline.status,
    },
  });
}

async function handleRetryPipeline(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  const pipelineId = args.pipeline_id as number;

  if (!projectId || pipelineId === undefined) {
    return error("project_id and pipeline_id are required");
  }

  const pipeline = await client.retryPipeline(projectId, pipelineId);
  return success({
    message: `Pipeline ${pipelineId} retried`,
    pipeline: {
      id: pipeline.id,
      status: pipeline.status,
      web_url: pipeline.web_url,
    },
  });
}

async function handleGetJobLog(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  const jobId = args.job_id as number;

  if (!projectId || jobId === undefined) {
    return error("project_id and job_id are required");
  }

  const log = await client.getJobLog(projectId, jobId);
  return success({
    job_id: jobId,
    log: log,
  });
}

// Commits
async function handleListCommits(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  if (!projectId) {
    return error("project_id is required");
  }

  const commits = await client.listCommits(projectId, {
    refName: args.ref_name as string | undefined,
    page: args.page as number | undefined,
    perPage: args.per_page as number | undefined,
  });

  return success({
    count: commits.length,
    commits: commits.map((c) => ({
      id: c.id,
      short_id: c.short_id,
      title: c.title,
      message: c.message,
      author_name: c.author_name,
      author_email: c.author_email,
      authored_date: c.authored_date,
      web_url: c.web_url,
    })),
  });
}

// Files
async function handleGetFile(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  const filePath = args.file_path as string;

  if (!projectId || !filePath) {
    return error("project_id and file_path are required");
  }

  const file = await client.getFileContent(
    projectId,
    filePath,
    args.ref as string | undefined
  );

  return success({
    file_name: file.file_name,
    file_path: file.file_path,
    size: file.size,
    encoding: file.encoding,
    ref: file.ref,
    content: file.content,
  });
}

async function handleListTree(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  if (!projectId) {
    return error("project_id is required");
  }

  const tree = await client.listTree(projectId, {
    path: args.path as string | undefined,
    ref: args.ref as string | undefined,
    recursive: args.recursive as boolean | undefined,
    page: args.page as number | undefined,
    perPage: args.per_page as number | undefined,
  });

  return success({
    count: tree.length,
    items: tree.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      path: item.path,
      mode: item.mode,
    })),
  });
}

async function handleCompare(
  client: GitLabClient,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectId = args.project_id as string;
  const from = args.from as string;
  const to = args.to as string;

  if (!projectId || !from || !to) {
    return error("project_id, from, and to are required");
  }

  const comparison = await client.compare(projectId, from, to);
  return success({
    commits: comparison.commits.map((c) => ({
      id: c.id,
      short_id: c.short_id,
      title: c.title,
      author_name: c.author_name,
      authored_date: c.authored_date,
    })),
    diffs: comparison.diffs.map((d) => ({
      old_path: d.old_path,
      new_path: d.new_path,
      diff: d.diff,
    })),
  });
}
