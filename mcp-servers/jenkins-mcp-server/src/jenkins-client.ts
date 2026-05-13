/**
 * Jenkins API Client
 *
 * Handles all HTTP interactions with Jenkins server.
 * Supports both username/token and username/password authentication.
 */

export interface JenkinsConfig {
  url: string;
  user: string;
  token: string;
}

export interface JenkinsJob {
  name: string;
  url: string;
  color: string;
  description?: string;
}

export interface JenkinsBuild {
  number: number;
  url: string;
  result: string | null;
  building: boolean;
  timestamp: number;
  duration: number;
  estimatedDuration: number;
  displayName: string;
  description?: string;
}

export interface JenkinsBuildInfo {
  number: number;
  result: string | null;
  building: boolean;
  timestamp: number;
  duration: number;
  estimatedDuration: number;
  displayName: string;
  description?: string;
  url: string;
  executor?: {
    currentExecutable?: {
      number: number;
    };
  };
  actions?: Array<{
    _class?: string;
    parameters?: Array<{
      name: string;
      value: string;
    }>;
  }>;
}

export interface JenkinsQueueItem {
  id: number;
  url: string;
  why: string;
  buildableStartMilliseconds?: number;
  executable?: {
    number: number;
    url: string;
  };
}

export interface JobConfig {
  xml: string;
}

export class JenkinsClient {
  private config: JenkinsConfig;
  private authHeader: string;

  constructor(config: JenkinsConfig) {
    this.config = {
      ...config,
      url: config.url.replace(/\/$/, ""), // Remove trailing slash
    };
    this.authHeader = this.createAuthHeader();
  }

  private createAuthHeader(): string {
    const credentials = `${this.config.user}:${this.config.token}`;
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
        `Jenkins API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    // Some endpoints return empty response
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

  private async requestText(
    path: string,
    options: RequestInit = {}
  ): Promise<string> {
    const url = `${this.config.url}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Jenkins API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.text();
  }

  /**
   * Get Jenkins server info
   */
  async getServerInfo(): Promise<{
    mode: string;
    nodeDescription: string;
    numExecutors: number;
  }> {
    return this.request("/api/json");
  }

  /**
   * List all jobs
   */
  async listJobs(folder?: string): Promise<JenkinsJob[]> {
    const path = folder
      ? `/job/${encodeURIComponent(folder)}/api/json?tree=jobs[name,url,color,description]`
      : "/api/json?tree=jobs[name,url,color,description]";

    const response = await this.request<{ jobs: JenkinsJob[] }>(path);
    return response.jobs || [];
  }

  /**
   * Get job details
   */
  async getJob(jobName: string): Promise<{
    name: string;
    url: string;
    color: string;
    description: string;
    buildable: boolean;
    builds: JenkinsBuild[];
    lastBuild: JenkinsBuild | null;
    lastSuccessfulBuild: JenkinsBuild | null;
    lastFailedBuild: JenkinsBuild | null;
    nextBuildNumber: number;
  }> {
    const path = `/job/${encodeURIComponent(jobName)}/api/json`;
    return this.request(path);
  }

  /**
   * Trigger a build
   */
  async triggerBuild(
    jobName: string,
    parameters?: Record<string, string>
  ): Promise<{ queueUrl: string; queueId: number }> {
    const encodedJobName = jobName
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/job/");

    let path: string;

    if (parameters && Object.keys(parameters).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(parameters)) {
        params.append(key, value);
      }
      path = `/job/${encodedJobName}/buildWithParameters?${params.toString()}`;
    } else {
      path = `/job/${encodedJobName}/build`;
    }

    const url = `${this.config.url}${path}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
      },
    });

    if (!response.ok && response.status !== 201) {
      const errorText = await response.text();
      throw new Error(
        `Failed to trigger build: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    // Get queue location from response header
    const queueUrl = response.headers.get("Location") || "";
    const queueIdMatch = queueUrl.match(/\/queue\/item\/(\d+)/);
    const queueId = queueIdMatch ? parseInt(queueIdMatch[1], 10) : 0;

    return { queueUrl, queueId };
  }

  /**
   * Get queue item status
   */
  async getQueueItem(queueId: number): Promise<JenkinsQueueItem> {
    const path = `/queue/item/${queueId}/api/json`;
    return this.request(path);
  }

  /**
   * Wait for queued build to start and return build number
   */
  async waitForBuildToStart(
    queueId: number,
    timeoutMs: number = 60000
  ): Promise<number> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const queueItem = await this.getQueueItem(queueId);

        if (queueItem.executable?.number) {
          return queueItem.executable.number;
        }
      } catch (error) {
        // Queue item might not exist yet or might have been consumed
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`Timeout waiting for build to start (queue ID: ${queueId})`);
  }

  /**
   * Get build info
   */
  async getBuild(jobName: string, buildNumber: number): Promise<JenkinsBuildInfo> {
    const encodedJobName = jobName
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/job/");

    const path = `/job/${encodedJobName}/${buildNumber}/api/json`;
    return this.request(path);
  }

  /**
   * Get build console output
   */
  async getBuildLog(
    jobName: string,
    buildNumber: number,
    start?: number
  ): Promise<{ text: string; hasMore: boolean; nextStart: number }> {
    const encodedJobName = jobName
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/job/");

    const startParam = start !== undefined ? `?start=${start}` : "";
    const path = `/job/${encodedJobName}/${buildNumber}/logText/progressiveText${startParam}`;

    const url = `${this.config.url}${path}`;

    const response = await fetch(url, {
      headers: {
        Authorization: this.authHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get build log: ${response.status}`);
    }

    const text = await response.text();
    const hasMore = response.headers.get("X-More-Data") === "true";
    const nextStart = parseInt(
      response.headers.get("X-Text-Size") || "0",
      10
    );

    return { text, hasMore, nextStart };
  }

  /**
   * Abort a build
   */
  async abortBuild(jobName: string, buildNumber: number): Promise<void> {
    const encodedJobName = jobName
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/job/");

    const path = `/job/${encodedJobName}/${buildNumber}/stop`;

    await fetch(`${this.config.url}${path}`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
      },
    });
  }

  /**
   * Get job configuration XML
   */
  async getJobConfig(jobName: string): Promise<string> {
    const encodedJobName = jobName
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/job/");

    const path = `/job/${encodedJobName}/config.xml`;
    return this.requestText(path);
  }

  /**
   * Get build test results
   */
  async getTestResults(
    jobName: string,
    buildNumber: number
  ): Promise<{
    failCount: number;
    passCount: number;
    skipCount: number;
    suites: Array<{
      name: string;
      cases: Array<{
        className: string;
        name: string;
        status: string;
        duration: number;
        errorDetails?: string;
      }>;
    }>;
  } | null> {
    const encodedJobName = jobName
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/job/");

    try {
      const path = `/job/${encodedJobName}/${buildNumber}/testReport/api/json`;
      return await this.request(path);
    } catch {
      // Test results might not exist
      return null;
    }
  }

  /**
   * Get build artifacts
   */
  async getBuildArtifacts(
    jobName: string,
    buildNumber: number
  ): Promise<
    Array<{
      displayPath: string;
      fileName: string;
      relativePath: string;
    }>
  > {
    const build = await this.getBuild(jobName, buildNumber);
    return (build as any).artifacts || [];
  }

  /**
   * Check if Jenkins is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getServerInfo();
      return true;
    } catch {
      return false;
    }
  }
}
