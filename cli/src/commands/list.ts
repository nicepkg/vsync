/**
 * vibe-sync list command
 * List all synced items (skills or MCP servers)
 */

import { cwd } from "node:process";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { loadManifest } from "@src/core/manifest-manager.js";
import type { Manifest } from "@src/types/manifest.js";
import type { MCPServer, Skill } from "@src/types/models.js";
import { t } from "@src/utils/i18n.js";
import { readSourceConfig } from "./sync.js";
import { ensureConfig } from "@src/utils/config-loader.js";

/**
 * Extract description from skill content
 *
 * @param content - Skill markdown content
 * @returns Description or empty string
 */
function extractDescription(content: string): string {
  // Look for markdown heading followed by description
  const lines = content.split("\n");
  let foundHeading = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip heading lines
    if (trimmed.startsWith("#")) {
      foundHeading = true;
      continue;
    }

    // First non-empty line after heading is the description
    if (foundHeading && trimmed) {
      return trimmed;
    }
  }

  return "-";
}

/**
 * Get synced targets for an item from manifest
 *
 * @param itemKey - Item key (e.g., "skill/name" or "mcp/name")
 * @param manifest - Manifest
 * @returns Comma-separated list of synced targets or "Not synced"
 */
function getSyncedTargets(itemKey: string, manifest: Manifest): string {
  const item = manifest.items[itemKey];
  if (!item || !item.targets) {
    return chalk.gray(t("commands.list.notSynced"));
  }

  const syncedTargets = Object.entries(item.targets)
    .filter(([_, target]) => target?.synced)
    .map(([toolName]) => toolName);

  if (syncedTargets.length === 0) {
    return chalk.gray(t("commands.list.notSynced"));
  }

  // Truncate if too many
  if (syncedTargets.length > 3) {
    return syncedTargets.slice(0, 2).join(", ") + ", ...";
  }

  return syncedTargets.join(", ");
}

/**
 * Truncate string to max length
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - 1) + "…";
}

/**
 * Format skills as a table
 *
 * @param skills - Skills to display
 * @param manifest - Manifest
 * @param sourceTool - Source tool name
 * @returns Formatted table string
 */
export function formatSkillsTable(
  skills: Skill[],
  manifest: Manifest,
  sourceTool: string,
): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(
    chalk.bold(
      t("commands.list.skillsTitle", {
        count: skills.length,
        source: sourceTool,
      }),
    ),
  );
  lines.push("━".repeat(80));
  lines.push("");

  if (skills.length === 0) {
    lines.push(chalk.gray(t("commands.list.noSkills")));
    lines.push("");
    return lines.join("\n");
  }

  // Table header
  lines.push(
    chalk.cyan(
      "┌────────────────────┬──────────────────────────────┬─────────────────┬──────────────┐",
    ),
  );
  lines.push(
    chalk.cyan(
      "│ Name               │ Description                  │ Synced To       │ Hash         │",
    ),
  );
  lines.push(
    chalk.cyan(
      "├────────────────────┼──────────────────────────────┼─────────────────┼──────────────┤",
    ),
  );

  // Table rows
  for (const skill of skills) {
    const name = truncate(skill.name, 18);
    const description = truncate(extractDescription(skill.content), 28);
    const syncedTo = truncate(
      getSyncedTargets(`skill/${skill.name}`, manifest),
      15,
    );
    const hash = skill.hash.substring(0, 8) + "...";

    lines.push(
      `│ ${name.padEnd(18)} │ ${description.padEnd(28)} │ ${syncedTo.padEnd(15)} │ ${hash.padEnd(12)} │`,
    );
  }

  lines.push(
    chalk.cyan(
      "└────────────────────┴──────────────────────────────┴─────────────────┴──────────────┘",
    ),
  );
  lines.push("");

  return lines.join("\n");
}

/**
 * Format MCP servers as a table
 *
 * @param mcpServers - MCP servers to display
 * @param manifest - Manifest
 * @param sourceTool - Source tool name
 * @returns Formatted table string
 */
export function formatMCPTable(
  mcpServers: MCPServer[],
  manifest: Manifest,
  sourceTool: string,
): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(
    chalk.bold(
      t("commands.list.mcpTitle", {
        count: mcpServers.length,
        source: sourceTool,
      }),
    ),
  );
  lines.push("━".repeat(90));
  lines.push("");

  if (mcpServers.length === 0) {
    lines.push(chalk.gray(t("commands.list.noMCP")));
    lines.push("");
    return lines.join("\n");
  }

  // Table header
  lines.push(
    chalk.cyan(
      "┌────────────────────┬────────┬────────────────────────────────────┬─────────────────┬──────────────┐",
    ),
  );
  lines.push(
    chalk.cyan(
      "│ Name               │ Type   │ Command/URL                        │ Synced To       │ Hash         │",
    ),
  );
  lines.push(
    chalk.cyan(
      "├────────────────────┼────────┼────────────────────────────────────┼─────────────────┼──────────────┤",
    ),
  );

  // Table rows
  for (const server of mcpServers) {
    const name = truncate(server.name, 18);
    const type = server.type.padEnd(6);

    let commandOrUrl = "";
    if (server.url) {
      commandOrUrl = server.url;
    } else if (server.command) {
      commandOrUrl = server.command;
      if (server.args && server.args.length > 0) {
        commandOrUrl += " " + server.args.join(" ");
      }
    }
    commandOrUrl = truncate(commandOrUrl, 34);

    const syncedTo = truncate(
      getSyncedTargets(`mcp/${server.name}`, manifest),
      15,
    );
    const hash = server.hash.substring(0, 8) + "...";

    lines.push(
      `│ ${name.padEnd(18)} │ ${type} │ ${commandOrUrl.padEnd(34)} │ ${syncedTo.padEnd(15)} │ ${hash.padEnd(12)} │`,
    );
  }

  lines.push(
    chalk.cyan(
      "└────────────────────┴────────┴────────────────────────────────────┴─────────────────┴──────────────┘",
    ),
  );
  lines.push("");

  return lines.join("\n");
}

/**
 * Run list command
 *
 * @param type - Item type to list (skills or mcp)
 * @param options - Command options
 */
async function listCommand(
  type: string | undefined,
  options: { user?: boolean },
): Promise<void> {
  try {
    const projectDir = options.user ? process.env.HOME || cwd() : cwd();

    // Load configuration (with auto-init if needed)
    const spinner = ora(t("commands.list.loadingConfig")).start();
    const config = await ensureConfig(projectDir, options.user || false, spinner);
    spinner.succeed(t("commands.list.configLoaded"));

    // Load manifest
    const manifest = await loadManifest(projectDir);

    // Read source data
    const readSpinner = ora(
      t("commands.list.reading", { tool: config.source_tool }),
    ).start();
    const sourceData = await readSourceConfig(
      config.source_tool,
      projectDir,
      config.level,
    );
    readSpinner.succeed(t("commands.list.configRead"));

    // Display based on type
    if (!type || type === "skills") {
      const table = formatSkillsTable(
        sourceData.skills,
        manifest,
        config.source_tool,
      );
      console.log(table);
    }

    if (!type || type === "mcp") {
      const table = formatMCPTable(
        sourceData.mcpServers,
        manifest,
        config.source_tool,
      );
      console.log(table);
    }

    if (type && type !== "skills" && type !== "mcp") {
      console.error(
        chalk.red(
          `\n❌ ${t("common.error")}: ${t("commands.list.unknownType", { type })}\n`,
        ),
      );
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ ${t("common.error")}: ${error.message}\n`));
      process.exit(1);
    }
  }
}

export function createListCommand(): Command {
  const command = new Command("list");

  command
    .description(t("commands.list.description"))
    .argument("[type]", t("commands.list.typeArgument"))
    .option("--user", t("commands.list.userLevelOption"))
    .action(async (type, options) => {
      await listCommand(type, options);
    });

  return command;
}
