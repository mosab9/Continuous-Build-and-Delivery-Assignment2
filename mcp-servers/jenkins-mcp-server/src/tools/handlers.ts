/**
 * MCP Tool Handlers for Jenkins
 *
 * Implements the logic for each tool.
 */

import { JenkinsClient } from "../jenkins-client.js";
import { CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js";

type ToolHandler = (
  client: JenkinsClient,
  args: Record<string, unknown>
) => Promise<CallToolResult>;

/**
 * Helper to create a text response
 */
function textResponse(content: string, isError = false): CallToolResult {
  return {
    content: [{ type: "text", text: content } as TextContent],
    isError,
  };
}

/**
 * Helper to create a JSON response
 */
function jsonResponse(data: unknown, isError = false): CallToolResult {
  return {
    content: [
      { type: "text", text: JSON.stringify(data, null, 2) } as TextContent,
    ],
    isError,
  };
}

/**
 * Format build status for display
 */
function formatBuildStatus(build: {
  number: number;
  result: string | null;
  building: boolean;
  timestamp: number;
  duration: number;
}): string {
  const status = build.building
    ? "🔄 RUNNING"
    : build.result === "SUCCESS"
      ? "✅ SUCCESS"
      : build.result === "FAILURE"
        ? "❌ FAILURE"
        : build.result === "ABORTED"
          ? "⏹️ ABORTED"
          : build.result === "UNSTABLE"
            ? "⚠️ UNSTABLE"
            : `❓ ${build.result || "UNKNOWN"}`;

  const date = new Date(build.timestamp).toISOString();
  const duration = build.building
    ? "In progress"
    : `${Math.round(build.duration / 1000)}s`;

  return `Build #${build.number}: ${status} | Started: ${date} | Duration: ${duration}`;
}

/**
 * Format job color to status
 */
function colorToStatus(color: string): string {
  const statusMap: Record<string, string> = {
    blue: "✅ Stable",
    blue_anime: "🔄 Building (was stable)",
    red: "❌ Failed",
    red_anime: "🔄 Building (was failed)",
    yellow: "⚠️ Unstable",
    yellow_anime: "🔄 Building (was unstable)",
    grey: "⚪ Not built",
    grey_anime: "🔄 Building (first build)",
    disabled: "🚫 Disabled",
    aborted: "⏹️ Aborted",
    aborted_anime: "🔄 Building (was aborted)",
    notbuilt: "⚪ Not built",
    notbuilt_anime: "🔄 Building (not built before)",
  };
  return statusMap[color] || color;
}

/**
 * List all jobs
 */
export const listJobs: ToolHandler = async (client, args) => {
  const folder = args.folder as string | undefined;

  const jobs = await client.listJobs(folder);

  if (jobs.length === 0) {
    return textResponse(
      folder ? `No jobs found in folder: ${folder}` : "No jobs found"
    );
  }

  const formatted = jobs.map((job) => ({
    name: job.name,
    status: colorToStatus(job.color),
    url: job.url,
    description: job.description || "",
  }));

  let output = folder ? `Jobs in folder '${folder}':\n\n` : "Jenkins Jobs:\n\n";

  formatted.forEach((job) => {
    output += `• ${job.name}\n`;
    output += `  Status: ${job.status}\n`;
    if (job.description) {
      output += `  Description: ${job.description}\n`;
    }
    output += `  URL: ${job.url}\n\n`;
  });

  output += `Total: ${jobs.length} job(s)`;

  return textResponse(output);
};

/**
 * Get job details
 */
export const getJob: ToolHandler = async (client, args) => {
  const jobName = args.job_name as string;

  const job = await client.getJob(jobName);

  let output = `Job: ${job.name}\n`;
  output += `${"─".repeat(40)}\n`;
  output += `Status: ${colorToStatus(job.color)}\n`;
  output += `Buildable: ${job.buildable ? "Yes" : "No"}\n`;
  output += `Next Build Number: #${job.nextBuildNumber}\n`;

  if (job.description) {
    output += `Description: ${job.description}\n`;
  }

  output += `URL: ${job.url}\n\n`;

  if (job.lastBuild) {
    output += `Last Build:\n`;
    output += `  ${formatBuildStatus(job.lastBuild)}\n`;
  }

  if (job.lastSuccessfulBuild) {
    output += `Last Successful: #${job.lastSuccessfulBuild.number}\n`;
  }

  if (job.lastFailedBuild) {
    output += `Last Failed: #${job.lastFailedBuild.number}\n`;
  }

  if (job.builds && job.builds.length > 0) {
    output += `\nRecent Builds (${Math.min(5, job.builds.length)} of ${job.builds.length}):\n`;
    job.builds.slice(0, 5).forEach((build) => {
      output += `  • #${build.number}\n`;
    });
  }

  return textResponse(output);
};

/**
 * Trigger a build
 */
export const triggerBuild: ToolHandler = async (client, args) => {
  const jobName = args.job_name as string;
  const parameters = args.parameters as Record<string, string> | undefined;
  const waitForStart = args.wait_for_start as boolean | undefined;

  const result = await client.triggerBuild(jobName, parameters);

  let output = `Build triggered for job: ${jobName}\n`;
  output += `Queue ID: ${result.queueId}\n`;

  if (parameters && Object.keys(parameters).length > 0) {
    output += `Parameters:\n`;
    Object.entries(parameters).forEach(([key, value]) => {
      output += `  ${key}: ${value}\n`;
    });
  }

  if (waitForStart && result.queueId) {
    output += `\nWaiting for build to start...\n`;
    try {
      const buildNumber = await client.waitForBuildToStart(result.queueId);
      output += `Build started: #${buildNumber}\n`;
      output += `\nUse jenkins_get_build or jenkins_get_build_log to monitor progress.`;
    } catch (error) {
      output += `Build is still queued. Use jenkins_get_queue to check status.`;
    }
  } else {
    output += `\nBuild is queued. Use jenkins_get_queue with queue_id ${result.queueId} to track.`;
  }

  return textResponse(output);
};

/**
 * Get build info
 */
export const getBuild: ToolHandler = async (client, args) => {
  const jobName = args.job_name as string;
  let buildNumber = args.build_number as number;

  // Handle -1 for latest build
  if (buildNumber === -1) {
    const job = await client.getJob(jobName);
    if (!job.lastBuild) {
      return textResponse(`No builds found for job: ${jobName}`, true);
    }
    buildNumber = job.lastBuild.number;
  }

  const build = await client.getBuild(jobName, buildNumber);

  let output = `Build #${build.number} - ${jobName}\n`;
  output += `${"─".repeat(40)}\n`;
  output += `${formatBuildStatus(build)}\n`;
  output += `URL: ${build.url}\n`;

  if (build.description) {
    output += `Description: ${build.description}\n`;
  }

  // Extract parameters from actions
  const paramsAction = build.actions?.find(
    (a) => a._class?.includes("ParametersAction")
  );
  if (paramsAction?.parameters && paramsAction.parameters.length > 0) {
    output += `\nParameters:\n`;
    paramsAction.parameters.forEach((p) => {
      output += `  ${p.name}: ${p.value}\n`;
    });
  }

  // Get artifacts
  const artifacts = await client.getBuildArtifacts(jobName, buildNumber);
  if (artifacts.length > 0) {
    output += `\nArtifacts (${artifacts.length}):\n`;
    artifacts.slice(0, 10).forEach((artifact) => {
      output += `  • ${artifact.fileName}\n`;
    });
    if (artifacts.length > 10) {
      output += `  ... and ${artifacts.length - 10} more\n`;
    }
  }

  return textResponse(output);
};

/**
 * Get build log
 */
export const getBuildLog: ToolHandler = async (client, args) => {
  const jobName = args.job_name as string;
  let buildNumber = args.build_number as number;
  const start = args.start as number | undefined;
  const maxLines = (args.max_lines as number) || 1000;

  // Handle -1 for latest build
  if (buildNumber === -1) {
    const job = await client.getJob(jobName);
    if (!job.lastBuild) {
      return textResponse(`No builds found for job: ${jobName}`, true);
    }
    buildNumber = job.lastBuild.number;
  }

  const log = await client.getBuildLog(jobName, buildNumber, start);

  let output = `Console Output - Build #${buildNumber} (${jobName})\n`;
  output += `${"─".repeat(50)}\n\n`;

  // Limit lines
  const lines = log.text.split("\n");
  const truncated = lines.length > maxLines;
  const displayLines = truncated ? lines.slice(0, maxLines) : lines;

  output += displayLines.join("\n");

  if (truncated) {
    output += `\n\n[Output truncated. Showing ${maxLines} of ${lines.length} lines]`;
  }

  if (log.hasMore) {
    output += `\n\n[More output available. Use start=${log.nextStart} to continue]`;
  }

  return textResponse(output);
};

/**
 * Abort a build
 */
export const abortBuild: ToolHandler = async (client, args) => {
  const jobName = args.job_name as string;
  let buildNumber = args.build_number as number;

  // Handle -1 for latest build
  if (buildNumber === -1) {
    const job = await client.getJob(jobName);
    if (!job.lastBuild) {
      return textResponse(`No builds found for job: ${jobName}`, true);
    }
    buildNumber = job.lastBuild.number;
  }

  // Check if build is actually running
  const build = await client.getBuild(jobName, buildNumber);
  if (!build.building) {
    return textResponse(
      `Build #${buildNumber} is not running (status: ${build.result})`,
      true
    );
  }

  await client.abortBuild(jobName, buildNumber);

  return textResponse(
    `Abort signal sent to build #${buildNumber} of job: ${jobName}\n\n` +
      `Note: The build may take a moment to stop.`
  );
};

/**
 * Get job configuration
 */
export const getJobConfig: ToolHandler = async (client, args) => {
  const jobName = args.job_name as string;

  const config = await client.getJobConfig(jobName);

  let output = `Job Configuration XML - ${jobName}\n`;
  output += `${"─".repeat(50)}\n\n`;
  output += config;

  return textResponse(output);
};

/**
 * Get test results
 */
export const getTestResults: ToolHandler = async (client, args) => {
  const jobName = args.job_name as string;
  let buildNumber = args.build_number as number;

  // Handle -1 for latest build
  if (buildNumber === -1) {
    const job = await client.getJob(jobName);
    if (!job.lastBuild) {
      return textResponse(`No builds found for job: ${jobName}`, true);
    }
    buildNumber = job.lastBuild.number;
  }

  const results = await client.getTestResults(jobName, buildNumber);

  if (!results) {
    return textResponse(
      `No test results found for build #${buildNumber} of job: ${jobName}`
    );
  }

  let output = `Test Results - Build #${buildNumber} (${jobName})\n`;
  output += `${"─".repeat(50)}\n\n`;

  const total = results.passCount + results.failCount + results.skipCount;
  output += `Summary:\n`;
  output += `  ✅ Passed: ${results.passCount}\n`;
  output += `  ❌ Failed: ${results.failCount}\n`;
  output += `  ⏭️ Skipped: ${results.skipCount}\n`;
  output += `  📊 Total: ${total}\n`;

  if (results.failCount > 0) {
    output += `\nFailed Tests:\n`;

    results.suites.forEach((suite) => {
      const failedCases = suite.cases.filter(
        (c) => c.status === "FAILED" || c.status === "REGRESSION"
      );
      if (failedCases.length > 0) {
        output += `\n  Suite: ${suite.name}\n`;
        failedCases.forEach((tc) => {
          output += `    ❌ ${tc.className}.${tc.name}\n`;
          if (tc.errorDetails) {
            const shortError = tc.errorDetails.split("\n")[0].substring(0, 100);
            output += `       Error: ${shortError}...\n`;
          }
        });
      }
    });
  }

  return textResponse(output);
};

/**
 * Get queue item
 */
export const getQueue: ToolHandler = async (client, args) => {
  const queueId = args.queue_id as number;

  const queueItem = await client.getQueueItem(queueId);

  let output = `Queue Item #${queueItem.id}\n`;
  output += `${"─".repeat(40)}\n`;

  if (queueItem.executable) {
    output += `Status: Build started\n`;
    output += `Build Number: #${queueItem.executable.number}\n`;
    output += `Build URL: ${queueItem.executable.url}\n`;
  } else {
    output += `Status: Waiting in queue\n`;
    output += `Reason: ${queueItem.why}\n`;
  }

  return textResponse(output);
};

/**
 * Health check
 */
export const healthCheck: ToolHandler = async (client) => {
  const isHealthy = await client.healthCheck();

  if (!isHealthy) {
    return textResponse(
      "❌ Jenkins server is not accessible. Check your configuration.",
      true
    );
  }

  const serverInfo = await client.getServerInfo();

  let output = `✅ Jenkins server is healthy\n`;
  output += `${"─".repeat(40)}\n`;
  output += `Mode: ${serverInfo.mode}\n`;
  output += `Description: ${serverInfo.nodeDescription}\n`;
  output += `Executors: ${serverInfo.numExecutors}\n`;

  return textResponse(output);
};

/**
 * Map tool names to handlers
 */
export const toolHandlers: Record<string, ToolHandler> = {
  jenkins_list_jobs: listJobs,
  jenkins_get_job: getJob,
  jenkins_trigger_build: triggerBuild,
  jenkins_get_build: getBuild,
  jenkins_get_build_log: getBuildLog,
  jenkins_abort_build: abortBuild,
  jenkins_get_job_config: getJobConfig,
  jenkins_get_test_results: getTestResults,
  jenkins_get_queue: getQueue,
  jenkins_health_check: healthCheck,
};
