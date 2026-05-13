/**
 * MCP Tool Handlers for SonarQube
 *
 * Implements the logic for each tool.
 */

import { SonarQubeClient } from "../sonarqube-client.js";
import { CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js";

type ToolHandler = (
  client: SonarQubeClient,
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
 * Format severity with emoji
 */
function formatSeverity(severity: string): string {
  const severityMap: Record<string, string> = {
    BLOCKER: "🔴 BLOCKER",
    CRITICAL: "🟠 CRITICAL",
    MAJOR: "🟡 MAJOR",
    MINOR: "🔵 MINOR",
    INFO: "⚪ INFO",
  };
  return severityMap[severity] || severity;
}

/**
 * Format issue type with emoji
 */
function formatType(type: string): string {
  const typeMap: Record<string, string> = {
    BUG: "🐛 Bug",
    VULNERABILITY: "🔓 Vulnerability",
    CODE_SMELL: "👃 Code Smell",
    SECURITY_HOTSPOT: "🔥 Security Hotspot",
  };
  return typeMap[type] || type;
}

/**
 * Format quality gate status
 */
function formatQualityGateStatus(status: string): string {
  const statusMap: Record<string, string> = {
    OK: "✅ PASSED",
    WARN: "⚠️ WARNING",
    ERROR: "❌ FAILED",
    NONE: "⚪ NONE",
  };
  return statusMap[status] || status;
}

/**
 * Health check handler
 */
export const healthCheck: ToolHandler = async (client) => {
  const isHealthy = await client.healthCheck();

  if (!isHealthy) {
    return textResponse(
      "❌ SonarQube server is not accessible. Check your configuration.",
      true
    );
  }

  const serverInfo = await client.getServerStatus();

  let output = `✅ SonarQube server is healthy\n`;
  output += `${"─".repeat(40)}\n`;
  output += `Version: ${serverInfo.version}\n`;
  output += `Status: ${serverInfo.status}\n`;
  output += `Server ID: ${serverInfo.id}\n`;

  return textResponse(output);
};

/**
 * List projects handler
 */
export const listProjects: ToolHandler = async (client, args) => {
  const query = args.query as string | undefined;
  const page = args.page as number | undefined;
  const pageSize = args.page_size as number | undefined;

  const result = await client.listProjects({
    query,
    page,
    pageSize: pageSize || 50,
  });

  if (result.projects.length === 0) {
    return textResponse(
      query
        ? `No projects found matching "${query}"`
        : "No projects found in SonarQube"
    );
  }

  let output = `SonarQube Projects (${result.projects.length} of ${result.total})\n`;
  output += `${"─".repeat(50)}\n\n`;

  for (const project of result.projects) {
    output += `📁 ${project.name}\n`;
    output += `   Key: ${project.key}\n`;
    output += `   Visibility: ${project.visibility}\n`;
    if (project.lastAnalysisDate) {
      output += `   Last Analysis: ${project.lastAnalysisDate}\n`;
    }
    output += `\n`;
  }

  if (result.total > result.projects.length) {
    output += `\n[Showing ${result.projects.length} of ${result.total} projects. Use page parameter to see more.]`;
  }

  return textResponse(output);
};

/**
 * Get quality gate status handler
 */
export const getQualityGate: ToolHandler = async (client, args) => {
  const projectKey = args.project_key as string;

  const status = await client.getQualityGateStatus(projectKey);

  let output = `Quality Gate Status: ${formatQualityGateStatus(status.status)}\n`;
  output += `Project: ${projectKey}\n`;
  output += `${"─".repeat(50)}\n\n`;

  if (status.conditions.length === 0) {
    output += `No conditions configured.\n`;
  } else {
    output += `Conditions:\n`;
    for (const condition of status.conditions) {
      const conditionStatus =
        condition.status === "OK" ? "✅" : condition.status === "ERROR" ? "❌" : "⚠️";
      output += `\n${conditionStatus} ${condition.metricKey}\n`;
      output += `   Actual: ${condition.actualValue}\n`;
      output += `   Threshold: ${condition.comparator} ${condition.errorThreshold || "N/A"}\n`;
    }
  }

  return textResponse(output);
};

/**
 * Get metrics handler
 */
export const getMetrics: ToolHandler = async (client, args) => {
  const projectKey = args.project_key as string;
  const requestedMetrics = args.metrics as string[] | undefined;

  // Default metrics if not specified
  const metricKeys = requestedMetrics || [
    "coverage",
    "bugs",
    "vulnerabilities",
    "code_smells",
    "duplicated_lines_density",
    "ncloc",
    "security_hotspots",
    "reliability_rating",
    "security_rating",
    "sqale_rating",
    "sqale_index",
  ];

  const measures = await client.getMeasures(projectKey, metricKeys);

  let output = `Code Quality Metrics\n`;
  output += `Project: ${projectKey}\n`;
  output += `${"─".repeat(50)}\n\n`;

  if (measures.length === 0) {
    output += `No metrics available. The project may not have been analyzed yet.\n`;
  } else {
    // Group metrics for better display
    const getValue = (key: string) =>
      measures.find((m) => m.metric === key)?.value;

    const coverage = getValue("coverage");
    const bugs = getValue("bugs");
    const vulnerabilities = getValue("vulnerabilities");
    const codeSmells = getValue("code_smells");
    const duplications = getValue("duplicated_lines_density");
    const ncloc = getValue("ncloc");
    const hotspots = getValue("security_hotspots");
    const reliabilityRating = getValue("reliability_rating");
    const securityRating = getValue("security_rating");
    const maintainabilityRating = getValue("sqale_rating");
    const technicalDebt = getValue("sqale_index");

    if (coverage !== undefined) {
      output += `📊 Coverage: ${coverage}%\n`;
    }
    if (ncloc !== undefined) {
      output += `📏 Lines of Code: ${parseInt(ncloc).toLocaleString()}\n`;
    }
    if (duplications !== undefined) {
      output += `📋 Duplications: ${duplications}%\n`;
    }

    output += `\n`;

    if (bugs !== undefined) {
      output += `🐛 Bugs: ${bugs}`;
      if (reliabilityRating) {
        output += ` (Rating: ${getRatingLetter(reliabilityRating)})`;
      }
      output += `\n`;
    }
    if (vulnerabilities !== undefined) {
      output += `🔓 Vulnerabilities: ${vulnerabilities}`;
      if (securityRating) {
        output += ` (Rating: ${getRatingLetter(securityRating)})`;
      }
      output += `\n`;
    }
    if (hotspots !== undefined) {
      output += `🔥 Security Hotspots: ${hotspots}\n`;
    }
    if (codeSmells !== undefined) {
      output += `👃 Code Smells: ${codeSmells}`;
      if (maintainabilityRating) {
        output += ` (Rating: ${getRatingLetter(maintainabilityRating)})`;
      }
      output += `\n`;
    }
    if (technicalDebt !== undefined) {
      output += `⏱️ Technical Debt: ${formatDebt(technicalDebt)}\n`;
    }
  }

  return textResponse(output);
};

/**
 * Convert rating value to letter
 */
function getRatingLetter(value: string): string {
  const rating = parseFloat(value);
  if (rating <= 1) return "A";
  if (rating <= 2) return "B";
  if (rating <= 3) return "C";
  if (rating <= 4) return "D";
  return "E";
}

/**
 * Format technical debt (in minutes)
 */
function formatDebt(minutes: string): string {
  const mins = parseInt(minutes);
  if (mins < 60) return `${mins}min`;
  if (mins < 480) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 480)}d`;
}

/**
 * Get issues handler
 */
export const getIssues: ToolHandler = async (client, args) => {
  const projectKey = args.project_key as string;
  const severities = args.severities as string[] | undefined;
  const types = args.types as string[] | undefined;
  const resolved = args.resolved as boolean | undefined;
  const page = args.page as number | undefined;
  const pageSize = args.page_size as number | undefined;

  const result = await client.getIssues({
    projectKey,
    severities,
    types,
    resolved: resolved ?? false,
    page,
    pageSize: pageSize || 20,
  });

  if (result.issues.length === 0) {
    return textResponse(
      `No ${resolved ? "resolved " : "open "}issues found for project: ${projectKey}`
    );
  }

  let output = `Issues (${result.issues.length} of ${result.total})\n`;
  output += `Project: ${projectKey}\n`;
  if (result.effortTotal) {
    output += `Total Effort: ${result.effortTotal}\n`;
  }
  output += `${"─".repeat(60)}\n\n`;

  for (const issue of result.issues) {
    output += `${formatSeverity(issue.severity)} | ${formatType(issue.type)}\n`;
    output += `   ${issue.message}\n`;
    output += `   📁 ${issue.component}`;
    if (issue.line) {
      output += `:${issue.line}`;
    }
    output += `\n`;
    output += `   Rule: ${issue.rule}\n`;
    if (issue.effort) {
      output += `   Effort: ${issue.effort}\n`;
    }
    output += `\n`;
  }

  if (result.total > result.issues.length) {
    output += `\n[Showing ${result.issues.length} of ${result.total} issues. Use page parameter to see more.]`;
  }

  return textResponse(output);
};

/**
 * Get hotspots handler
 */
export const getHotspots: ToolHandler = async (client, args) => {
  const projectKey = args.project_key as string;
  const status = args.status as string | undefined;
  const page = args.page as number | undefined;
  const pageSize = args.page_size as number | undefined;

  const result = await client.getHotspots({
    projectKey,
    status: status || "TO_REVIEW",
    page,
    pageSize: pageSize || 20,
  });

  if (result.hotspots.length === 0) {
    return textResponse(
      `No security hotspots found for project: ${projectKey}`
    );
  }

  let output = `Security Hotspots (${result.hotspots.length} of ${result.total})\n`;
  output += `Project: ${projectKey}\n`;
  output += `${"─".repeat(60)}\n\n`;

  for (const hotspot of result.hotspots) {
    const riskEmoji =
      hotspot.vulnerabilityProbability === "HIGH"
        ? "🔴"
        : hotspot.vulnerabilityProbability === "MEDIUM"
          ? "🟠"
          : "🟡";

    output += `${riskEmoji} ${hotspot.securityCategory} (${hotspot.vulnerabilityProbability} risk)\n`;
    output += `   ${hotspot.message}\n`;
    output += `   📁 ${hotspot.component}`;
    if (hotspot.line) {
      output += `:${hotspot.line}`;
    }
    output += `\n`;
    output += `   Status: ${hotspot.status}\n`;
    output += `\n`;
  }

  if (result.total > result.hotspots.length) {
    output += `\n[Showing ${result.hotspots.length} of ${result.total} hotspots. Use page parameter to see more.]`;
  }

  return textResponse(output);
};

/**
 * Get coverage handler
 */
export const getCoverage: ToolHandler = async (client, args) => {
  const projectKey = args.project_key as string;

  const coverage = await client.getCoverage(projectKey);

  let output = `Code Coverage Report\n`;
  output += `Project: ${projectKey}\n`;
  output += `${"─".repeat(40)}\n\n`;

  if (!coverage.coverage && !coverage.lineCoverage) {
    output += `No coverage data available.\n`;
    output += `Make sure your build tool is configured to generate coverage reports.\n`;
  } else {
    if (coverage.coverage) {
      const coverageValue = parseFloat(coverage.coverage);
      const emoji = coverageValue >= 80 ? "✅" : coverageValue >= 50 ? "⚠️" : "❌";
      output += `${emoji} Overall Coverage: ${coverage.coverage}%\n`;
    }
    if (coverage.lineCoverage) {
      output += `   Line Coverage: ${coverage.lineCoverage}%\n`;
    }
    if (coverage.branchCoverage) {
      output += `   Branch Coverage: ${coverage.branchCoverage}%\n`;
    }
    output += `\n`;
    if (coverage.linesToCover) {
      output += `📊 Lines to Cover: ${parseInt(coverage.linesToCover).toLocaleString()}\n`;
    }
    if (coverage.uncoveredLines) {
      output += `📊 Uncovered Lines: ${parseInt(coverage.uncoveredLines).toLocaleString()}\n`;
    }
  }

  return textResponse(output);
};

/**
 * Get duplications handler
 */
export const getDuplications: ToolHandler = async (client, args) => {
  const componentKey = args.component_key as string;

  const result = await client.getDuplications(componentKey);

  let output = `Code Duplications\n`;
  output += `Component: ${componentKey}\n`;
  output += `${"─".repeat(50)}\n\n`;

  if (!result.duplications || result.duplications.length === 0) {
    output += `No duplications found in this file.\n`;
  } else {
    output += `Found ${result.duplications.length} duplication(s):\n\n`;

    for (let i = 0; i < result.duplications.length; i++) {
      const dup = result.duplications[i];
      output += `Duplication ${i + 1}:\n`;

      for (const block of dup.blocks) {
        const file = result.files[block._ref];
        output += `   📁 ${file?.name || block._ref}\n`;
        output += `      Lines ${block.from} - ${block.from + block.size - 1} (${block.size} lines)\n`;
      }
      output += `\n`;
    }
  }

  return textResponse(output);
};

/**
 * Get source handler
 */
export const getSource: ToolHandler = async (client, args) => {
  const componentKey = args.component_key as string;
  const fromLine = args.from_line as number | undefined;
  const toLine = args.to_line as number | undefined;

  const result = await client.getSourceWithIssues(componentKey, fromLine, toLine);

  let output = `Source Code\n`;
  output += `Component: ${componentKey}\n`;
  if (fromLine || toLine) {
    output += `Lines: ${fromLine || 1} - ${toLine || "end"}\n`;
  }
  output += `${"─".repeat(60)}\n\n`;

  if (!result.sources || result.sources.length === 0) {
    output += `No source code available.\n`;
  } else {
    for (const line of result.sources) {
      const lineNum = line.line.toString().padStart(4, " ");
      const newIndicator = line.isNew ? " +" : "  ";
      output += `${lineNum}${newIndicator}│ ${line.code}\n`;
    }
  }

  return textResponse(output);
};

/**
 * Get analysis history handler
 */
export const getAnalysisHistory: ToolHandler = async (client, args) => {
  const projectKey = args.project_key as string;
  const page = args.page as number | undefined;
  const pageSize = args.page_size as number | undefined;

  const result = await client.getAnalysisHistory(projectKey, {
    page,
    pageSize: pageSize || 10,
  });

  let output = `Analysis History\n`;
  output += `Project: ${projectKey}\n`;
  output += `${"─".repeat(50)}\n\n`;

  if (!result.analyses || result.analyses.length === 0) {
    output += `No analysis history available.\n`;
  } else {
    for (const analysis of result.analyses) {
      output += `📅 ${analysis.date}\n`;
      output += `   Key: ${analysis.key}\n`;

      if (analysis.events && analysis.events.length > 0) {
        output += `   Events:\n`;
        for (const event of analysis.events) {
          const emoji =
            event.category === "QUALITY_GATE"
              ? "🚦"
              : event.category === "VERSION"
                ? "🏷️"
                : "📌";
          output += `     ${emoji} ${event.name} (${event.category})\n`;
        }
      }
      output += `\n`;
    }
  }

  return textResponse(output);
};

/**
 * Get tasks handler
 */
export const getTasks: ToolHandler = async (client, args) => {
  const projectKey = args.project_key as string | undefined;
  const status = args.status as string | undefined;
  const page = args.page as number | undefined;
  const pageSize = args.page_size as number | undefined;

  const result = await client.getTasks({
    componentKey: projectKey,
    status,
    page,
    pageSize: pageSize || 20,
  });

  let output = `Analysis Tasks\n`;
  if (projectKey) {
    output += `Project: ${projectKey}\n`;
  }
  output += `${"─".repeat(50)}\n\n`;

  if (result.tasks.length === 0) {
    output += `No tasks found.\n`;
  } else {
    for (const task of result.tasks) {
      const statusEmoji =
        task.status === "SUCCESS"
          ? "✅"
          : task.status === "FAILED"
            ? "❌"
            : task.status === "IN_PROGRESS"
              ? "🔄"
              : task.status === "PENDING"
                ? "⏳"
                : "⚪";

      output += `${statusEmoji} ${task.status}\n`;
      output += `   Component: ${task.componentKey}\n`;
      output += `   Type: ${task.type}\n`;
      output += `   Submitted: ${task.submittedAt}\n`;

      if (task.executedAt) {
        output += `   Executed: ${task.executedAt}\n`;
      }
      if (task.executionTimeMs) {
        output += `   Duration: ${task.executionTimeMs}ms\n`;
      }
      if (task.errorMessage) {
        output += `   Error: ${task.errorMessage}\n`;
      }
      output += `\n`;
    }
  }

  return textResponse(output);
};

/**
 * Get quality gates handler
 */
export const getQualityGates: ToolHandler = async (client) => {
  const result = await client.getQualityGates();

  let output = `Quality Gates\n`;
  output += `${"─".repeat(40)}\n\n`;

  if (!result.qualitygates || result.qualitygates.length === 0) {
    output += `No quality gates configured.\n`;
  } else {
    for (const gate of result.qualitygates) {
      const defaultTag = gate.isDefault ? " (Default)" : "";
      const builtInTag = gate.isBuiltIn ? " [Built-in]" : "";
      output += `🚦 ${gate.name}${defaultTag}${builtInTag}\n`;
      output += `   ID: ${gate.id}\n`;

      if (gate.conditions && gate.conditions.length > 0) {
        output += `   Conditions:\n`;
        for (const condition of gate.conditions) {
          output += `     - ${condition.metric} ${condition.op} ${condition.error}\n`;
        }
      }
      output += `\n`;
    }
  }

  return textResponse(output);
};

/**
 * Get rules handler
 */
export const getRules: ToolHandler = async (client, args) => {
  const languages = args.languages as string[] | undefined;
  const severities = args.severities as string[] | undefined;
  const types = args.types as string[] | undefined;
  const page = args.page as number | undefined;
  const pageSize = args.page_size as number | undefined;

  const result = await client.getRules({
    languages,
    severities,
    types,
    page,
    pageSize: pageSize || 25,
  });

  let output = `Analysis Rules (${result.rules.length} of ${result.total})\n`;
  output += `${"─".repeat(60)}\n\n`;

  if (result.rules.length === 0) {
    output += `No rules found matching the criteria.\n`;
  } else {
    for (const rule of result.rules) {
      output += `${formatSeverity(rule.severity)} | ${formatType(rule.type)}\n`;
      output += `   ${rule.name}\n`;
      output += `   Key: ${rule.key}\n`;
      output += `   Language: ${rule.langName}\n`;
      output += `\n`;
    }

    if (result.total > result.rules.length) {
      output += `\n[Showing ${result.rules.length} of ${result.total} rules. Use page parameter to see more.]`;
    }
  }

  return textResponse(output);
};

/**
 * Map tool names to handlers
 */
export const toolHandlers: Record<string, ToolHandler> = {
  sonar_health_check: healthCheck,
  sonar_list_projects: listProjects,
  sonar_get_quality_gate: getQualityGate,
  sonar_get_metrics: getMetrics,
  sonar_get_issues: getIssues,
  sonar_get_hotspots: getHotspots,
  sonar_get_coverage: getCoverage,
  sonar_get_duplications: getDuplications,
  sonar_get_source: getSource,
  sonar_get_analysis_history: getAnalysisHistory,
  sonar_get_tasks: getTasks,
  sonar_get_quality_gates: getQualityGates,
  sonar_get_rules: getRules,
};
