/**
 * Central Configuration Loader
 *
 * Loads configuration from:
 * 1. config.json file (primary)
 * 2. Environment variables (fallback/override)
 *
 * Environment variables take precedence over config file values.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Jenkins configuration
 */
export interface JenkinsConfig {
  url: string;
  user: string;
  token: string;
}

/**
 * SonarQube configuration
 */
export interface SonarQubeConfig {
  url: string;
  token: string;
}

/**
 * GitLab configuration
 */
export interface GitLabConfig {
  url: string;
  token: string;
}

/**
 * Complete configuration structure
 */
export interface MCPConfig {
  jenkins?: JenkinsConfig;
  sonarqube?: SonarQubeConfig;
  gitlab?: GitLabConfig;
}

/**
 * Find the config file by searching up the directory tree
 */
function findConfigFile(startDir: string): string | null {
  const configNames = ["config.json", "config.local.json"];
  let currentDir = startDir;

  // Search up to 5 levels
  for (let i = 0; i < 5; i++) {
    for (const configName of configNames) {
      const configPath = join(currentDir, configName);
      if (existsSync(configPath)) {
        return configPath;
      }
    }

    // Also check in mcp-servers directory
    const mcpServersConfig = join(currentDir, "mcp-servers", "config.json");
    if (existsSync(mcpServersConfig)) {
      return mcpServersConfig;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break; // Reached root
    currentDir = parentDir;
  }

  return null;
}

/**
 * Load configuration from file
 */
function loadConfigFile(configPath: string): MCPConfig {
  try {
    const content = readFileSync(configPath, "utf-8");
    return JSON.parse(content) as MCPConfig;
  } catch (error) {
    console.error(`Warning: Failed to parse config file: ${configPath}`);
    return {};
  }
}

/**
 * Configuration loader class
 */
export class ConfigLoader {
  private config: MCPConfig = {};
  private configPath: string | null = null;

  constructor() {
    this.load();
  }

  /**
   * Load configuration from file and merge with environment variables
   */
  private load(): void {
    // Determine starting directory for config search
    let startDir: string;
    try {
      // For ES modules
      const __filename = fileURLToPath(import.meta.url);
      startDir = dirname(__filename);
    } catch {
      // Fallback to process.cwd()
      startDir = process.cwd();
    }

    // Find and load config file
    this.configPath = findConfigFile(startDir);

    if (this.configPath) {
      console.error(`Loading config from: ${this.configPath}`);
      this.config = loadConfigFile(this.configPath);
    } else {
      console.error("No config.json found, using environment variables only");
      this.config = {};
    }
  }

  /**
   * Get the path to the loaded config file
   */
  getConfigPath(): string | null {
    return this.configPath;
  }

  /**
   * Get Jenkins configuration
   * Environment variables override config file values
   */
  getJenkinsConfig(): JenkinsConfig {
    const fileConfig: Partial<JenkinsConfig> = this.config.jenkins || {};

    return {
      url: process.env.JENKINS_URL || fileConfig.url || "",
      user: process.env.JENKINS_USER || fileConfig.user || "",
      token: process.env.JENKINS_TOKEN || fileConfig.token || "",
    };
  }

  /**
   * Get SonarQube configuration
   * Environment variables override config file values
   */
  getSonarQubeConfig(): SonarQubeConfig {
    const fileConfig: Partial<SonarQubeConfig> = this.config.sonarqube || {};

    return {
      url: process.env.SONAR_URL || fileConfig.url || "",
      token: process.env.SONAR_TOKEN || fileConfig.token || "",
    };
  }

  /**
   * Get GitLab configuration
   * Environment variables override config file values
   */
  getGitLabConfig(): GitLabConfig {
    const fileConfig: Partial<GitLabConfig> = this.config.gitlab || {};

    return {
      url: process.env.GITLAB_URL || fileConfig.url || "",
      token: process.env.GITLAB_TOKEN || fileConfig.token || "",
    };
  }

  /**
   * Validate Jenkins configuration
   */
  validateJenkinsConfig(): { valid: boolean; missing: string[] } {
    const config = this.getJenkinsConfig();
    const missing: string[] = [];

    if (!config.url) missing.push("url (JENKINS_URL)");
    if (!config.user) missing.push("user (JENKINS_USER)");
    if (!config.token) missing.push("token (JENKINS_TOKEN)");

    return { valid: missing.length === 0, missing };
  }

  /**
   * Validate SonarQube configuration
   */
  validateSonarQubeConfig(): { valid: boolean; missing: string[] } {
    const config = this.getSonarQubeConfig();
    const missing: string[] = [];

    if (!config.url) missing.push("url (SONAR_URL)");
    if (!config.token) missing.push("token (SONAR_TOKEN)");

    return { valid: missing.length === 0, missing };
  }

  /**
   * Validate GitLab configuration
   */
  validateGitLabConfig(): { valid: boolean; missing: string[] } {
    const config = this.getGitLabConfig();
    const missing: string[] = [];

    if (!config.url) missing.push("url (GITLAB_URL)");
    if (!config.token) missing.push("token (GITLAB_TOKEN)");

    return { valid: missing.length === 0, missing };
  }
}

/**
 * Singleton instance
 */
let configLoaderInstance: ConfigLoader | null = null;

/**
 * Get the config loader instance
 */
export function getConfigLoader(): ConfigLoader {
  if (!configLoaderInstance) {
    configLoaderInstance = new ConfigLoader();
  }
  return configLoaderInstance;
}

/**
 * Convenience function to get Jenkins config
 */
export function getJenkinsConfig(): JenkinsConfig {
  return getConfigLoader().getJenkinsConfig();
}

/**
 * Convenience function to get SonarQube config
 */
export function getSonarQubeConfig(): SonarQubeConfig {
  return getConfigLoader().getSonarQubeConfig();
}

/**
 * Convenience function to get GitLab config
 */
export function getGitLabConfig(): GitLabConfig {
  return getConfigLoader().getGitLabConfig();
}
