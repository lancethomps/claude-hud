import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createDebug } from './debug.js';

const debug = createDebug('config');

export interface ConfigCounts {
  claudeMdCount: number;
  rulesCount: number;
  mcpCount: number;
  hooksCount: number;
}

export interface ConfigDetails {
  claudeMdFiles: string[];
  rulesFiles: string[];
  mcpServers: string[];
  hooks: string[];
}

// Valid keys for disabled MCP arrays in config files
type DisabledMcpKey = 'disabledMcpServers' | 'disabledMcpjsonServers';

function getMcpServerNames(filePath: string): Set<string> {
  if (!fs.existsSync(filePath)) return new Set();
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(content);
    if (config.mcpServers && typeof config.mcpServers === 'object') {
      return new Set(Object.keys(config.mcpServers));
    }
  } catch (error) {
    debug(`Failed to read MCP servers from ${filePath}:`, error);
  }
  return new Set();
}

function getDisabledMcpServers(filePath: string, key: DisabledMcpKey): Set<string> {
  if (!fs.existsSync(filePath)) return new Set();
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(content);
    if (Array.isArray(config[key])) {
      const validNames = config[key].filter((s: unknown) => typeof s === 'string');
      if (validNames.length !== config[key].length) {
        debug(`${key} in ${filePath} contains non-string values, ignoring them`);
      }
      return new Set(validNames);
    }
  } catch (error) {
    debug(`Failed to read ${key} from ${filePath}:`, error);
  }
  return new Set();
}

function getHookNames(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(content);
    if (config.hooks && typeof config.hooks === 'object') {
      return Object.keys(config.hooks);
    }
  } catch (error) {
    debug(`Failed to read hooks from ${filePath}:`, error);
  }
  return [];
}

function getRulesInDir(rulesDir: string, basePath = ''): string[] {
  if (!fs.existsSync(rulesDir)) return [];
  const rules: string[] = [];
  try {
    const entries = fs.readdirSync(rulesDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(rulesDir, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        rules.push(...getRulesInDir(fullPath, relativePath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        rules.push(relativePath);
      }
    }
  } catch (error) {
    debug(`Failed to read rules from ${rulesDir}:`, error);
  }
  return rules;
}

export interface ConfigResult {
  counts: ConfigCounts;
  details: ConfigDetails;
}

export async function countConfigs(cwd?: string): Promise<ConfigResult> {
  const claudeMdFiles: string[] = [];
  const rulesFiles: string[] = [];
  const hooks: string[] = [];

  const homeDir = os.homedir();
  const claudeDir = path.join(homeDir, '.claude');

  // Collect all MCP servers across scopes, then subtract disabled ones
  const userMcpServers = new Set<string>();
  const projectMcpServers = new Set<string>();

  // === USER SCOPE ===

  // ~/.claude/CLAUDE.md
  if (fs.existsSync(path.join(claudeDir, 'CLAUDE.md'))) {
    claudeMdFiles.push('~/.claude/CLAUDE.md');
  }

  // ~/.claude/rules/*.md
  const userRules = getRulesInDir(path.join(claudeDir, 'rules'));
  for (const rule of userRules) {
    rulesFiles.push(`~/.claude/rules/${rule}`);
  }

  // ~/.claude/settings.json (MCPs and hooks)
  const userSettings = path.join(claudeDir, 'settings.json');
  for (const name of getMcpServerNames(userSettings)) {
    userMcpServers.add(name);
  }
  for (const hook of getHookNames(userSettings)) {
    hooks.push(hook);
  }

  // ~/.claude.json (additional user-scope MCPs)
  const userClaudeJson = path.join(homeDir, '.claude.json');
  for (const name of getMcpServerNames(userClaudeJson)) {
    userMcpServers.add(name);
  }

  // Get disabled user-scope MCPs from ~/.claude.json
  const disabledUserMcps = getDisabledMcpServers(userClaudeJson, 'disabledMcpServers');
  for (const name of disabledUserMcps) {
    userMcpServers.delete(name);
  }

  // === PROJECT SCOPE ===

  if (cwd) {
    // {cwd}/CLAUDE.md
    if (fs.existsSync(path.join(cwd, 'CLAUDE.md'))) {
      claudeMdFiles.push('CLAUDE.md');
    }

    // {cwd}/CLAUDE.local.md
    if (fs.existsSync(path.join(cwd, 'CLAUDE.local.md'))) {
      claudeMdFiles.push('CLAUDE.local.md');
    }

    // {cwd}/.claude/CLAUDE.md (alternative location)
    if (fs.existsSync(path.join(cwd, '.claude', 'CLAUDE.md'))) {
      claudeMdFiles.push('.claude/CLAUDE.md');
    }

    // {cwd}/.claude/CLAUDE.local.md
    if (fs.existsSync(path.join(cwd, '.claude', 'CLAUDE.local.md'))) {
      claudeMdFiles.push('.claude/CLAUDE.local.md');
    }

    // {cwd}/.claude/rules/*.md (recursive)
    const projectRules = getRulesInDir(path.join(cwd, '.claude', 'rules'));
    for (const rule of projectRules) {
      rulesFiles.push(`.claude/rules/${rule}`);
    }

    // {cwd}/.mcp.json (project MCP config) - tracked separately for disabled filtering
    const mcpJsonServers = getMcpServerNames(path.join(cwd, '.mcp.json'));

    // {cwd}/.claude/settings.json (project settings)
    const projectSettings = path.join(cwd, '.claude', 'settings.json');
    for (const name of getMcpServerNames(projectSettings)) {
      projectMcpServers.add(name);
    }
    for (const hook of getHookNames(projectSettings)) {
      if (!hooks.includes(hook)) {
        hooks.push(hook);
      }
    }

    // {cwd}/.claude/settings.local.json (local project settings)
    const localSettings = path.join(cwd, '.claude', 'settings.local.json');
    for (const name of getMcpServerNames(localSettings)) {
      projectMcpServers.add(name);
    }
    for (const hook of getHookNames(localSettings)) {
      if (!hooks.includes(hook)) {
        hooks.push(hook);
      }
    }

    // Get disabled .mcp.json servers from settings.local.json
    const disabledMcpJsonServers = getDisabledMcpServers(localSettings, 'disabledMcpjsonServers');
    for (const name of disabledMcpJsonServers) {
      mcpJsonServers.delete(name);
    }

    // Add remaining .mcp.json servers to project set
    for (const name of mcpJsonServers) {
      projectMcpServers.add(name);
    }
  }

  // Combine MCP servers from both scopes
  const mcpServers = [...userMcpServers, ...projectMcpServers];

  const counts: ConfigCounts = {
    claudeMdCount: claudeMdFiles.length,
    rulesCount: rulesFiles.length,
    mcpCount: mcpServers.length,
    hooksCount: hooks.length,
  };

  const details: ConfigDetails = {
    claudeMdFiles,
    rulesFiles,
    mcpServers,
    hooks,
  };

  return { counts, details };
}

