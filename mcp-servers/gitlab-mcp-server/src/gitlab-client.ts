/**
 * GitLab API Client
 *
 * Handles all HTTP interactions with GitLab server.
 * Supports personal access token authentication.
 */

export interface GitLabConfig {
  url: string;
  token: string;
}

export interface Project {
  id: number;
  name: string;
  name_with_namespace: string;
  path: string;
  path_with_namespace: string;
  description: string | null;
  default_branch: string;
  visibility: string;
  web_url: string;
  ssh_url_to_repo: string;
  http_url_to_repo: string;
  created_at: string;
  last_activity_at: string;
  star_count: number;
  forks_count: number;
  open_issues_count?: number;
}

export interface Branch {
  name: string;
  commit: {
    id: string;
    short_id: string;
    title: string;
    author_name: string;
    authored_date: string;
  };
  merged: boolean;
  protected: boolean;
  default: boolean;
  web_url: string;
}

export interface MergeRequest {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: string;
  source_branch: string;
  target_branch: string;
  author: {
    id: number;
    username: string;
    name: string;
  };
  assignee?: {
    id: number;
    username: string;
    name: string;
  };
  web_url: string;
  created_at: string;
  updated_at: string;
  merged_at?: string;
  closed_at?: string;
  merge_status: string;
  draft: boolean;
  labels: string[];
}

export interface Issue {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: string;
  author: {
    id: number;
    username: string;
    name: string;
  };
  assignees: Array<{
    id: number;
    username: string;
    name: string;
  }>;
  labels: string[];
  milestone?: {
    id: number;
    title: string;
  };
  web_url: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface Pipeline {
  id: number;
  iid: number;
  status: string;
  ref: string;
  sha: string;
  web_url: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  finished_at?: string;
  duration?: number;
  source: string;
}

export interface Job {
  id: number;
  name: string;
  stage: string;
  status: string;
  ref: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  duration?: number;
  web_url: string;
  pipeline: {
    id: number;
    status: string;
  };
}

export interface Commit {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string;
  committer_name: string;
  committed_date: string;
  web_url: string;
}

export interface FileContent {
  file_name: string;
  file_path: string;
  size: number;
  encoding: string;
  content: string;
  content_sha256: string;
  ref: string;
  blob_id: string;
  last_commit_id: string;
}

export interface TreeItem {
  id: string;
  name: string;
  type: "tree" | "blob";
  path: string;
  mode: string;
}

export interface User {
  id: number;
  username: string;
  name: string;
  state: string;
  avatar_url: string;
  web_url: string;
}

export class GitLabClient {
  private config: GitLabConfig;

  constructor(config: GitLabConfig) {
    this.config = {
      ...config,
      url: config.url.replace(/\/$/, ""), // Remove trailing slash
    };
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.url}/api/v4${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        "PRIVATE-TOKEN": this.config.token,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `GitLab API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  /**
   * Health check - get current user
   */
  async getCurrentUser(): Promise<User> {
    return this.request<User>("/user");
  }

  /**
   * Check if GitLab is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getCurrentUser();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List projects
   */
  async listProjects(options?: {
    owned?: boolean;
    membership?: boolean;
    search?: string;
    page?: number;
    perPage?: number;
  }): Promise<Project[]> {
    const params = new URLSearchParams();
    if (options?.owned) params.append("owned", "true");
    if (options?.membership) params.append("membership", "true");
    if (options?.search) params.append("search", options.search);
    if (options?.page) params.append("page", options.page.toString());
    if (options?.perPage) params.append("per_page", options.perPage.toString());

    const queryString = params.toString();
    const path = `/projects${queryString ? `?${queryString}` : ""}`;

    return this.request<Project[]>(path);
  }

  /**
   * Get project details
   */
  async getProject(projectId: string | number): Promise<Project> {
    const encoded = encodeURIComponent(String(projectId));
    return this.request<Project>(`/projects/${encoded}`);
  }

  /**
   * List branches
   */
  async listBranches(
    projectId: string | number,
    options?: { search?: string; page?: number; perPage?: number }
  ): Promise<Branch[]> {
    const encoded = encodeURIComponent(String(projectId));
    const params = new URLSearchParams();
    if (options?.search) params.append("search", options.search);
    if (options?.page) params.append("page", options.page.toString());
    if (options?.perPage) params.append("per_page", options.perPage.toString());

    const queryString = params.toString();
    const path = `/projects/${encoded}/repository/branches${queryString ? `?${queryString}` : ""}`;

    return this.request<Branch[]>(path);
  }

  /**
   * Get branch details
   */
  async getBranch(projectId: string | number, branchName: string): Promise<Branch> {
    const encodedProject = encodeURIComponent(String(projectId));
    const encodedBranch = encodeURIComponent(branchName);
    return this.request<Branch>(
      `/projects/${encodedProject}/repository/branches/${encodedBranch}`
    );
  }

  /**
   * Create branch
   */
  async createBranch(
    projectId: string | number,
    branchName: string,
    ref: string
  ): Promise<Branch> {
    const encoded = encodeURIComponent(String(projectId));
    return this.request<Branch>(`/projects/${encoded}/repository/branches`, {
      method: "POST",
      body: JSON.stringify({ branch: branchName, ref }),
    });
  }

  /**
   * List merge requests
   */
  async listMergeRequests(
    projectId: string | number,
    options?: {
      state?: "opened" | "closed" | "merged" | "all";
      page?: number;
      perPage?: number;
    }
  ): Promise<MergeRequest[]> {
    const encoded = encodeURIComponent(String(projectId));
    const params = new URLSearchParams();
    if (options?.state) params.append("state", options.state);
    if (options?.page) params.append("page", options.page.toString());
    if (options?.perPage) params.append("per_page", options.perPage.toString());

    const queryString = params.toString();
    const path = `/projects/${encoded}/merge_requests${queryString ? `?${queryString}` : ""}`;

    return this.request<MergeRequest[]>(path);
  }

  /**
   * Get merge request details
   */
  async getMergeRequest(
    projectId: string | number,
    mrIid: number
  ): Promise<MergeRequest> {
    const encoded = encodeURIComponent(String(projectId));
    return this.request<MergeRequest>(
      `/projects/${encoded}/merge_requests/${mrIid}`
    );
  }

  /**
   * Create merge request
   */
  async createMergeRequest(
    projectId: string | number,
    options: {
      sourceBranch: string;
      targetBranch: string;
      title: string;
      description?: string;
      assigneeId?: number;
      labels?: string[];
    }
  ): Promise<MergeRequest> {
    const encoded = encodeURIComponent(String(projectId));
    return this.request<MergeRequest>(`/projects/${encoded}/merge_requests`, {
      method: "POST",
      body: JSON.stringify({
        source_branch: options.sourceBranch,
        target_branch: options.targetBranch,
        title: options.title,
        description: options.description,
        assignee_id: options.assigneeId,
        labels: options.labels?.join(","),
      }),
    });
  }

  /**
   * List issues
   */
  async listIssues(
    projectId: string | number,
    options?: {
      state?: "opened" | "closed" | "all";
      labels?: string[];
      page?: number;
      perPage?: number;
    }
  ): Promise<Issue[]> {
    const encoded = encodeURIComponent(String(projectId));
    const params = new URLSearchParams();
    if (options?.state) params.append("state", options.state);
    if (options?.labels) params.append("labels", options.labels.join(","));
    if (options?.page) params.append("page", options.page.toString());
    if (options?.perPage) params.append("per_page", options.perPage.toString());

    const queryString = params.toString();
    const path = `/projects/${encoded}/issues${queryString ? `?${queryString}` : ""}`;

    return this.request<Issue[]>(path);
  }

  /**
   * Get issue details
   */
  async getIssue(projectId: string | number, issueIid: number): Promise<Issue> {
    const encoded = encodeURIComponent(String(projectId));
    return this.request<Issue>(`/projects/${encoded}/issues/${issueIid}`);
  }

  /**
   * Create issue
   */
  async createIssue(
    projectId: string | number,
    options: {
      title: string;
      description?: string;
      assigneeIds?: number[];
      labels?: string[];
      milestoneId?: number;
    }
  ): Promise<Issue> {
    const encoded = encodeURIComponent(String(projectId));
    return this.request<Issue>(`/projects/${encoded}/issues`, {
      method: "POST",
      body: JSON.stringify({
        title: options.title,
        description: options.description,
        assignee_ids: options.assigneeIds,
        labels: options.labels?.join(","),
        milestone_id: options.milestoneId,
      }),
    });
  }

  /**
   * List pipelines
   */
  async listPipelines(
    projectId: string | number,
    options?: {
      status?: string;
      ref?: string;
      page?: number;
      perPage?: number;
    }
  ): Promise<Pipeline[]> {
    const encoded = encodeURIComponent(String(projectId));
    const params = new URLSearchParams();
    if (options?.status) params.append("status", options.status);
    if (options?.ref) params.append("ref", options.ref);
    if (options?.page) params.append("page", options.page.toString());
    if (options?.perPage) params.append("per_page", options.perPage.toString());

    const queryString = params.toString();
    const path = `/projects/${encoded}/pipelines${queryString ? `?${queryString}` : ""}`;

    return this.request<Pipeline[]>(path);
  }

  /**
   * Get pipeline details
   */
  async getPipeline(
    projectId: string | number,
    pipelineId: number
  ): Promise<Pipeline> {
    const encoded = encodeURIComponent(String(projectId));
    return this.request<Pipeline>(
      `/projects/${encoded}/pipelines/${pipelineId}`
    );
  }

  /**
   * Get pipeline jobs
   */
  async getPipelineJobs(
    projectId: string | number,
    pipelineId: number
  ): Promise<Job[]> {
    const encoded = encodeURIComponent(String(projectId));
    return this.request<Job[]>(
      `/projects/${encoded}/pipelines/${pipelineId}/jobs`
    );
  }

  /**
   * Trigger pipeline
   */
  async triggerPipeline(
    projectId: string | number,
    ref: string,
    variables?: Record<string, string>
  ): Promise<Pipeline> {
    const encoded = encodeURIComponent(String(projectId));
    const body: Record<string, unknown> = { ref };

    if (variables) {
      body.variables = Object.entries(variables).map(([key, value]) => ({
        key,
        value,
      }));
    }

    return this.request<Pipeline>(`/projects/${encoded}/pipeline`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * Cancel pipeline
   */
  async cancelPipeline(
    projectId: string | number,
    pipelineId: number
  ): Promise<Pipeline> {
    const encoded = encodeURIComponent(String(projectId));
    return this.request<Pipeline>(
      `/projects/${encoded}/pipelines/${pipelineId}/cancel`,
      { method: "POST" }
    );
  }

  /**
   * Retry pipeline
   */
  async retryPipeline(
    projectId: string | number,
    pipelineId: number
  ): Promise<Pipeline> {
    const encoded = encodeURIComponent(String(projectId));
    return this.request<Pipeline>(
      `/projects/${encoded}/pipelines/${pipelineId}/retry`,
      { method: "POST" }
    );
  }

  /**
   * Get job log
   */
  async getJobLog(projectId: string | number, jobId: number): Promise<string> {
    const encoded = encodeURIComponent(String(projectId));
    const url = `${this.config.url}/api/v4/projects/${encoded}/jobs/${jobId}/trace`;

    const response = await fetch(url, {
      headers: {
        "PRIVATE-TOKEN": this.config.token,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get job log: ${response.status}`);
    }

    return response.text();
  }

  /**
   * List commits
   */
  async listCommits(
    projectId: string | number,
    options?: {
      refName?: string;
      page?: number;
      perPage?: number;
    }
  ): Promise<Commit[]> {
    const encoded = encodeURIComponent(String(projectId));
    const params = new URLSearchParams();
    if (options?.refName) params.append("ref_name", options.refName);
    if (options?.page) params.append("page", options.page.toString());
    if (options?.perPage) params.append("per_page", options.perPage.toString());

    const queryString = params.toString();
    const path = `/projects/${encoded}/repository/commits${queryString ? `?${queryString}` : ""}`;

    return this.request<Commit[]>(path);
  }

  /**
   * Get commit details
   */
  async getCommit(projectId: string | number, sha: string): Promise<Commit> {
    const encoded = encodeURIComponent(String(projectId));
    return this.request<Commit>(
      `/projects/${encoded}/repository/commits/${sha}`
    );
  }

  /**
   * Get file content
   */
  async getFileContent(
    projectId: string | number,
    filePath: string,
    ref: string = "main"
  ): Promise<FileContent> {
    const encodedProject = encodeURIComponent(String(projectId));
    const encodedPath = encodeURIComponent(filePath);
    return this.request<FileContent>(
      `/projects/${encodedProject}/repository/files/${encodedPath}?ref=${ref}`
    );
  }

  /**
   * List repository tree
   */
  async listTree(
    projectId: string | number,
    options?: {
      path?: string;
      ref?: string;
      recursive?: boolean;
      page?: number;
      perPage?: number;
    }
  ): Promise<TreeItem[]> {
    const encoded = encodeURIComponent(String(projectId));
    const params = new URLSearchParams();
    if (options?.path) params.append("path", options.path);
    if (options?.ref) params.append("ref", options.ref);
    if (options?.recursive) params.append("recursive", "true");
    if (options?.page) params.append("page", options.page.toString());
    if (options?.perPage) params.append("per_page", options.perPage.toString());

    const queryString = params.toString();
    const path = `/projects/${encoded}/repository/tree${queryString ? `?${queryString}` : ""}`;

    return this.request<TreeItem[]>(path);
  }

  /**
   * Compare branches/tags/commits
   */
  async compare(
    projectId: string | number,
    from: string,
    to: string
  ): Promise<{
    commit: Commit;
    commits: Commit[];
    diffs: Array<{
      old_path: string;
      new_path: string;
      diff: string;
    }>;
  }> {
    const encoded = encodeURIComponent(String(projectId));
    return this.request(
      `/projects/${encoded}/repository/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );
  }

  /**
   * Get project members
   */
  async listProjectMembers(
    projectId: string | number,
    options?: { page?: number; perPage?: number }
  ): Promise<
    Array<{
      id: number;
      username: string;
      name: string;
      access_level: number;
    }>
  > {
    const encoded = encodeURIComponent(String(projectId));
    const params = new URLSearchParams();
    if (options?.page) params.append("page", options.page.toString());
    if (options?.perPage) params.append("per_page", options.perPage.toString());

    const queryString = params.toString();
    const path = `/projects/${encoded}/members${queryString ? `?${queryString}` : ""}`;

    return this.request(path);
  }
}
