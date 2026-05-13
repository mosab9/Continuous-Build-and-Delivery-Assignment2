/**
 * SonarQube API Client
 *
 * Handles all HTTP interactions with SonarQube server.
 * Supports token-based authentication.
 */

export interface SonarQubeConfig {
  url: string;
  token: string;
}

export interface Project {
  key: string;
  name: string;
  qualifier: string;
  visibility: string;
  lastAnalysisDate?: string;
}

export interface ProjectStatus {
  status: "OK" | "WARN" | "ERROR" | "NONE";
  conditions: Array<{
    status: string;
    metricKey: string;
    comparator: string;
    errorThreshold?: string;
    actualValue: string;
  }>;
}

export interface Issue {
  key: string;
  rule: string;
  severity: string;
  component: string;
  project: string;
  line?: number;
  message: string;
  type: string;
  status: string;
  effort?: string;
  debt?: string;
  author?: string;
  creationDate: string;
  updateDate: string;
}

export interface Metric {
  key: string;
  name: string;
  description: string;
  domain: string;
  type: string;
  qualitative: boolean;
}

export interface Measure {
  metric: string;
  value?: string;
  period?: {
    value: string;
    bestValue?: boolean;
  };
}

export interface Hotspot {
  key: string;
  component: string;
  project: string;
  securityCategory: string;
  vulnerabilityProbability: string;
  status: string;
  line?: number;
  message: string;
  author?: string;
  creationDate: string;
}

export interface QualityGate {
  id: string;
  name: string;
  isDefault: boolean;
  isBuiltIn: boolean;
  conditions?: Array<{
    id: number;
    metric: string;
    op: string;
    error: string;
  }>;
}

export interface AnalysisTask {
  id: string;
  type: string;
  componentKey: string;
  status: string;
  submittedAt: string;
  startedAt?: string;
  executedAt?: string;
  executionTimeMs?: number;
  errorMessage?: string;
}

export class SonarQubeClient {
  private config: SonarQubeConfig;
  private authHeader: string;

  constructor(config: SonarQubeConfig) {
    this.config = {
      ...config,
      url: config.url.replace(/\/$/, ""), // Remove trailing slash
    };
    this.authHeader = this.createAuthHeader();
  }

  private createAuthHeader(): string {
    // SonarQube uses token as username with empty password
    const credentials = `${this.config.token}:`;
    const encoded = Buffer.from(credentials).toString("base64");
    return `Basic ${encoded}`;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.url}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `SonarQube API error: ${response.status} ${response.statusText} - ${errorText}`
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
   * Get server status and version
   */
  async getServerStatus(): Promise<{
    id: string;
    version: string;
    status: string;
  }> {
    return this.request("/api/system/status");
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const status = await this.getServerStatus();
      return status.status === "UP";
    } catch {
      return false;
    }
  }

  /**
   * List all projects
   */
  async listProjects(options?: {
    page?: number;
    pageSize?: number;
    query?: string;
  }): Promise<{ projects: Project[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.page) params.append("p", options.page.toString());
    if (options?.pageSize) params.append("ps", options.pageSize.toString());
    if (options?.query) params.append("q", options.query);

    const queryString = params.toString();
    const path = `/api/projects/search${queryString ? `?${queryString}` : ""}`;

    const response = await this.request<{
      components: Project[];
      paging: { total: number };
    }>(path);

    return {
      projects: response.components || [],
      total: response.paging?.total || 0,
    };
  }

  /**
   * Get project details
   */
  async getProject(projectKey: string): Promise<Project | null> {
    try {
      const response = await this.request<{ component: Project }>(
        `/api/components/show?component=${encodeURIComponent(projectKey)}`
      );
      return response.component;
    } catch {
      return null;
    }
  }

  /**
   * Get quality gate status for a project
   */
  async getQualityGateStatus(projectKey: string): Promise<ProjectStatus> {
    const response = await this.request<{ projectStatus: ProjectStatus }>(
      `/api/qualitygates/project_status?projectKey=${encodeURIComponent(projectKey)}`
    );
    return response.projectStatus;
  }

  /**
   * Get project measures/metrics
   */
  async getMeasures(
    projectKey: string,
    metricKeys: string[]
  ): Promise<Measure[]> {
    const metrics = metricKeys.join(",");
    const response = await this.request<{
      component: { measures: Measure[] };
    }>(
      `/api/measures/component?component=${encodeURIComponent(projectKey)}&metricKeys=${metrics}`
    );
    return response.component?.measures || [];
  }

  /**
   * Get all available metrics
   */
  async getMetricDefinitions(): Promise<Metric[]> {
    const response = await this.request<{ metrics: Metric[] }>(
      "/api/metrics/search?ps=500"
    );
    return response.metrics || [];
  }

  /**
   * Get issues for a project
   */
  async getIssues(options: {
    projectKey: string;
    severities?: string[];
    types?: string[];
    statuses?: string[];
    page?: number;
    pageSize?: number;
    resolved?: boolean;
  }): Promise<{ issues: Issue[]; total: number; effortTotal?: string }> {
    const params = new URLSearchParams();
    params.append("componentKeys", options.projectKey);

    if (options.severities?.length) {
      params.append("severities", options.severities.join(","));
    }
    if (options.types?.length) {
      params.append("types", options.types.join(","));
    }
    if (options.statuses?.length) {
      params.append("statuses", options.statuses.join(","));
    }
    if (options.page) {
      params.append("p", options.page.toString());
    }
    if (options.pageSize) {
      params.append("ps", options.pageSize.toString());
    }
    if (options.resolved !== undefined) {
      params.append("resolved", options.resolved.toString());
    }

    const response = await this.request<{
      issues: Issue[];
      paging: { total: number };
      effortTotal?: number;
    }>(`/api/issues/search?${params.toString()}`);

    return {
      issues: response.issues || [],
      total: response.paging?.total || 0,
      effortTotal: response.effortTotal
        ? `${response.effortTotal} min`
        : undefined,
    };
  }

  /**
   * Get security hotspots
   */
  async getHotspots(options: {
    projectKey: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ hotspots: Hotspot[]; total: number }> {
    const params = new URLSearchParams();
    params.append("projectKey", options.projectKey);

    if (options.status) {
      params.append("status", options.status);
    }
    if (options.page) {
      params.append("p", options.page.toString());
    }
    if (options.pageSize) {
      params.append("ps", options.pageSize.toString());
    }

    const response = await this.request<{
      hotspots: Hotspot[];
      paging: { total: number };
    }>(`/api/hotspots/search?${params.toString()}`);

    return {
      hotspots: response.hotspots || [],
      total: response.paging?.total || 0,
    };
  }

  /**
   * Get source code with issues highlighted
   */
  async getSourceWithIssues(
    componentKey: string,
    fromLine?: number,
    toLine?: number
  ): Promise<{
    sources: Array<{ line: number; code: string; isNew?: boolean }>;
  }> {
    const params = new URLSearchParams();
    params.append("key", componentKey);
    if (fromLine) params.append("from", fromLine.toString());
    if (toLine) params.append("to", toLine.toString());

    const response = await this.request<{
      sources: Array<{ line: number; code: string; isNew?: boolean }>;
    }>(`/api/sources/lines?${params.toString()}`);

    return response;
  }

  /**
   * Get duplications in a file
   */
  async getDuplications(componentKey: string): Promise<{
    duplications: Array<{
      blocks: Array<{
        from: number;
        size: number;
        _ref: string;
      }>;
    }>;
    files: Record<string, { key: string; name: string }>;
  }> {
    const response = await this.request<{
      duplications: Array<{
        blocks: Array<{ from: number; size: number; _ref: string }>;
      }>;
      files: Record<string, { key: string; name: string }>;
    }>(`/api/duplications/show?key=${encodeURIComponent(componentKey)}`);

    return response;
  }

  /**
   * Get analysis history
   */
  async getAnalysisHistory(
    projectKey: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<{
    analyses: Array<{
      key: string;
      date: string;
      events: Array<{ key: string; category: string; name: string }>;
    }>;
  }> {
    const params = new URLSearchParams();
    params.append("project", projectKey);
    if (options?.page) params.append("p", options.page.toString());
    if (options?.pageSize) params.append("ps", options.pageSize.toString());

    const response = await this.request<{
      analyses: Array<{
        key: string;
        date: string;
        events: Array<{ key: string; category: string; name: string }>;
      }>;
    }>(`/api/project_analyses/search?${params.toString()}`);

    return response;
  }

  /**
   * Get background tasks (analysis tasks)
   */
  async getTasks(options?: {
    componentKey?: string;
    status?: string;
    type?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ tasks: AnalysisTask[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.componentKey) params.append("component", options.componentKey);
    if (options?.status) params.append("status", options.status);
    if (options?.type) params.append("type", options.type);
    if (options?.page) params.append("p", options.page.toString());
    if (options?.pageSize) params.append("ps", options.pageSize.toString());

    const queryString = params.toString();
    const path = `/api/ce/activity${queryString ? `?${queryString}` : ""}`;

    const response = await this.request<{
      tasks: AnalysisTask[];
      paging?: { total: number };
    }>(path);

    return {
      tasks: response.tasks || [],
      total: response.paging?.total || response.tasks?.length || 0,
    };
  }

  /**
   * Get current task queue
   */
  async getTaskQueue(): Promise<{ queue: AnalysisTask[] }> {
    const response = await this.request<{ queue: AnalysisTask[] }>(
      "/api/ce/queue"
    );
    return response;
  }

  /**
   * Get quality gates
   */
  async getQualityGates(): Promise<{ qualitygates: QualityGate[] }> {
    const response = await this.request<{
      qualitygates: QualityGate[];
    }>("/api/qualitygates/list");
    return response;
  }

  /**
   * Get rules
   */
  async getRules(options?: {
    languages?: string[];
    severities?: string[];
    types?: string[];
    page?: number;
    pageSize?: number;
  }): Promise<{
    rules: Array<{
      key: string;
      name: string;
      severity: string;
      type: string;
      lang: string;
      langName: string;
    }>;
    total: number;
  }> {
    const params = new URLSearchParams();
    if (options?.languages?.length) {
      params.append("languages", options.languages.join(","));
    }
    if (options?.severities?.length) {
      params.append("severities", options.severities.join(","));
    }
    if (options?.types?.length) {
      params.append("types", options.types.join(","));
    }
    if (options?.page) params.append("p", options.page.toString());
    if (options?.pageSize) params.append("ps", options.pageSize.toString());

    const queryString = params.toString();
    const path = `/api/rules/search${queryString ? `?${queryString}` : ""}`;

    const response = await this.request<{
      rules: Array<{
        key: string;
        name: string;
        severity: string;
        type: string;
        lang: string;
        langName: string;
      }>;
      total: number;
    }>(path);

    return response;
  }

  /**
   * Get code coverage for a component
   */
  async getCoverage(componentKey: string): Promise<{
    coverage: string | null;
    lineCoverage: string | null;
    branchCoverage: string | null;
    linesToCover: string | null;
    uncoveredLines: string | null;
  }> {
    const measures = await this.getMeasures(componentKey, [
      "coverage",
      "line_coverage",
      "branch_coverage",
      "lines_to_cover",
      "uncovered_lines",
    ]);

    const getValue = (key: string) =>
      measures.find((m) => m.metric === key)?.value || null;

    return {
      coverage: getValue("coverage"),
      lineCoverage: getValue("line_coverage"),
      branchCoverage: getValue("branch_coverage"),
      linesToCover: getValue("lines_to_cover"),
      uncoveredLines: getValue("uncovered_lines"),
    };
  }
}
