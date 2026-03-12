/**
 * Skillbox VSCode Extension — main entry point.
 *
 * Registers:
 *   - Two tree views: "Available Skills" and "Installed Skills"
 *   - All commands: install, remove, refresh, preview, search, detect, installProject
 *   - Auto-detects AI tools on activation and shows a status message
 *
 * Compatible with both VSCode and Cursor (a VSCode fork).
 */

import * as vscode from "vscode";
import { AvailableSkillsProvider, SkillItem } from "./providers/availableSkillsProvider";
import {
  InstalledSkillsProvider,
  InstalledSkillItem,
} from "./providers/installedSkillsProvider";
import {
  RecommendedSkillsProvider,
  RecommendedSkillItem,
} from "./providers/recommendedSkillsProvider";
import { SearchViewProvider } from "./providers/searchViewProvider";
import { SkillDetailPanel } from "./views/skillDetailPanel";
import { detectTools, getInstalledTools } from "./lib/detector";
import { installSkill, removeSkill, isInstalled } from "./lib/installer";
import type { Skill } from "./lib/types";

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  // ── Tree providers ──────────────────────────────────────────────────────
  const availableProvider = new AvailableSkillsProvider();
  const installedProvider = new InstalledSkillsProvider();
  const recommendedProvider = new RecommendedSkillsProvider();
  const searchProvider = new SearchViewProvider(context.extensionUri);

  const availableView = vscode.window.createTreeView("skillbox.available", {
    treeDataProvider: availableProvider,
    showCollapseAll: true,
  });

  const installedView = vscode.window.createTreeView("skillbox.installed", {
    treeDataProvider: installedProvider,
    showCollapseAll: false,
  });

  const recommendedView = vscode.window.createTreeView("skillbox.recommended", {
    treeDataProvider: recommendedProvider,
    showCollapseAll: true,
  });

  const searchViewDisposable = vscode.window.registerWebviewViewProvider(
    SearchViewProvider.viewType,
    searchProvider
  );

  // ── Commands ────────────────────────────────────────────────────────────

  // Install globally
  const cmdInstall = vscode.commands.registerCommand(
    "skillbox.install",
    async (item?: SkillItem | InstalledSkillItem) => {
      const skill = await resolveSkill(item);
      if (!skill) return;

      if (isInstalled(skill.id)) {
        vscode.window.showInformationMessage(
          `"${skill.name}" is already installed.`
        );
        return;
      }

      await doInstall(skill, false, context, availableProvider, installedProvider);
    }
  );

  // Install project-locally
  const cmdInstallProject = vscode.commands.registerCommand(
    "skillbox.installProject",
    async (item?: SkillItem | InstalledSkillItem) => {
      const skill = await resolveSkill(item);
      if (!skill) return;

      const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceDir) {
        vscode.window.showWarningMessage(
          "Open a workspace folder first to install a skill project-locally."
        );
        return;
      }

      await doInstall(
        skill,
        true,
        context,
        availableProvider,
        installedProvider,
        workspaceDir
      );
    }
  );

  // Remove
  const cmdRemove = vscode.commands.registerCommand(
    "skillbox.remove",
    async (item?: InstalledSkillItem | SkillItem) => {
      let skillId: string | undefined;
      let skillName: string | undefined;

      if (item instanceof InstalledSkillItem) {
        skillId = item.record.id;
        const parts = item.record.id.split("/");
        skillName = parts[parts.length - 1];
      } else if (item instanceof SkillItem) {
        skillId = item.skill.id;
        skillName = item.skill.name;
      } else {
        // No item passed — not typically reached via command palette but handle it
        vscode.window.showWarningMessage("Select a skill to remove.");
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Remove "${skillName}"? This will delete it from all installed AI tools.`,
        { modal: true },
        "Remove"
      );
      if (confirm !== "Remove") return;

      const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Removing "${skillName}"...`,
          cancellable: false,
        },
        async () => {
          try {
            await removeSkill(skillId!, workspaceDir);
            availableProvider.invalidate();
            installedProvider.refresh();
            vscode.window.showInformationMessage(
              `"${skillName}" has been removed.`
            );
          } catch (err) {
            vscode.window.showErrorMessage(
              `Failed to remove skill: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }
      );
    }
  );

  // Refresh
  const cmdRefresh = vscode.commands.registerCommand(
    "skillbox.refresh",
    () => {
      availableProvider.refresh(true);
      installedProvider.refresh();
      vscode.window.showInformationMessage("Skillbox: refreshing registry...");
    }
  );

  // Preview
  const cmdPreview = vscode.commands.registerCommand(
    "skillbox.preview",
    async (item?: SkillItem | InstalledSkillItem | RecommendedSkillItem) => {
      const skill = await resolveSkill(item);
      if (!skill) return;

      await SkillDetailPanel.show(
        skill,
        context.extensionUri,
        // onInstall callback from the webview
        async (s: Skill) => {
          await doInstall(s, false, context, availableProvider, installedProvider);
          recommendedProvider.invalidate();
        },
        // onRemove callback from the webview
        async (skillId: string) => {
          const workspaceDir =
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          await removeSkill(skillId, workspaceDir);
          availableProvider.invalidate();
          installedProvider.refresh();
          recommendedProvider.invalidate();
        }
      );
    }
  );

  // Search
  const cmdSearch = vscode.commands.registerCommand("skillbox.search", async () => {
    const query = await vscode.window.showInputBox({
      placeHolder: "Search skills by name, tag, or category...",
      prompt: "Type to filter available skills",
    });

    if (query === undefined) return; // cancelled
    if (query.trim() === "") {
      availableProvider.clearSearch();
      availableView.message = undefined;
    } else {
      availableProvider.setSearchQuery(query);
      availableView.message = `Filtering by: "${query}" — click Refresh to clear`;
    }
  });

  // Refresh recommended
  const cmdRefreshRecommended = vscode.commands.registerCommand(
    "skillbox.refreshRecommended",
    () => {
      recommendedProvider.refresh();
      vscode.window.showInformationMessage("Skillbox: rescanning workspace...");
    }
  );

  // Preview by ID (used by search webview and recommended view)
  const cmdPreviewById = vscode.commands.registerCommand(
    "skillbox.previewById",
    async (skill: Skill) => {
      if (!skill) return;
      await SkillDetailPanel.show(
        skill,
        context.extensionUri,
        async (s: Skill) => {
          await doInstall(s, false, context, availableProvider, installedProvider);
          recommendedProvider.invalidate();
        },
        async (skillId: string) => {
          const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          await removeSkill(skillId, workspaceDir);
          availableProvider.invalidate();
          installedProvider.refresh();
          recommendedProvider.invalidate();
        }
      );
    }
  );

  // Install by ID (used by search webview)
  const cmdInstallById = vscode.commands.registerCommand(
    "skillbox.installById",
    async (skill: Skill) => {
      if (!skill) return;
      if (isInstalled(skill.id)) {
        vscode.window.showInformationMessage(`"${skill.name}" is already installed.`);
        return;
      }
      await doInstall(skill, false, context, availableProvider, installedProvider);
      recommendedProvider.invalidate();
    }
  );

  // Detect AI tools
  const cmdDetect = vscode.commands.registerCommand(
    "skillbox.detect",
    async () => {
      const tools = detectTools();
      const detected = tools.filter((t) => t.detected);
      const notDetected = tools.filter((t) => !t.detected);

      const lines: string[] = [];

      if (detected.length > 0) {
        lines.push("Detected tools:");
        detected.forEach((t) => {
          lines.push(
            `  • ${t.label} — ${t.installedCount ?? 0} skill(s) installed`
          );
        });
      }

      if (notDetected.length > 0) {
        lines.push("\nNot found:");
        notDetected.forEach((t) => {
          lines.push(`  • ${t.label}`);
        });
      }

      if (detected.length === 0) {
        vscode.window.showWarningMessage(
          "No AI tools detected. Install Claude Code, Cursor, or Codex CLI first.",
          "Learn More"
        );
      } else {
        vscode.window.showInformationMessage(lines.join("\n"));
      }
    }
  );

  // ── Auto-detect on startup ───────────────────────────────────────────────
  const detectedTools = getInstalledTools();
  if (detectedTools.length > 0) {
    const names = detectedTools.map((t) => t.label).join(", ");
    // Subtle status — don't spam the user
    availableView.message = `Ready · ${names} detected`;
    // Clear the status after 8s so it doesn't clutter the view
    setTimeout(() => {
      availableView.message = undefined;
    }, 8000);
  } else {
    availableView.message = "No AI tools detected. Run 'Detect AI Tools' for details.";
    setTimeout(() => {
      availableView.message = undefined;
    }, 12000);
  }

  // ── Register all disposables ─────────────────────────────────────────────
  context.subscriptions.push(
    availableView,
    installedView,
    recommendedView,
    searchViewDisposable,
    cmdInstall,
    cmdInstallProject,
    cmdRemove,
    cmdRefresh,
    cmdPreview,
    cmdSearch,
    cmdDetect,
    cmdRefreshRecommended,
    cmdPreviewById,
    cmdInstallById
  );
}

export function deactivate(): void {
  // Nothing to clean up — subscriptions are disposed automatically
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a Skill from a tree item, or prompt the user to pick from registry.
 */
async function resolveSkill(
  item?: SkillItem | InstalledSkillItem | RecommendedSkillItem
): Promise<Skill | undefined> {
  if (item instanceof SkillItem) {
    return item.skill;
  }

  if (item instanceof RecommendedSkillItem) {
    return item.skill;
  }

  if (item instanceof InstalledSkillItem) {
    // For installed items we need to look up the full skill in the registry.
    // Dynamically import to avoid circular dep at top level.
    const { fetchRegistry } = await import("./lib/registry");
    try {
      const registry = await fetchRegistry();
      return registry.skills.find((s) => s.id === item.record.id);
    } catch {
      vscode.window.showErrorMessage(
        "Could not load registry to find skill details."
      );
      return undefined;
    }
  }

  return undefined;
}

/**
 * Install a skill with progress notification and both-view refresh.
 */
async function doInstall(
  skill: Skill,
  projectLocal: boolean,
  context: vscode.ExtensionContext,
  availableProvider: AvailableSkillsProvider,
  installedProvider: InstalledSkillsProvider,
  workspaceDir?: string
): Promise<void> {
  const label = projectLocal ? "project-locally" : "globally";

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Installing "${skill.name}" ${label}...`,
      cancellable: false,
    },
    async () => {
      try {
        const results = await installSkill(skill, {
          global: !projectLocal,
          project: projectLocal,
          workspaceDir,
        });

        const succeeded = results.filter((r) => r.success && !r.skipped);
        const failed = results.filter((r) => !r.success);

        if (succeeded.length > 0) {
          const toolNames = succeeded.map((r) => r.tool).join(", ");
          vscode.window.showInformationMessage(
            `"${skill.name}" installed ${label} → ${toolNames}`
          );
        }

        if (failed.length > 0) {
          const errMsg = failed.map((r) => `${r.tool}: ${r.error}`).join("; ");
          vscode.window.showErrorMessage(
            `Install partially failed — ${errMsg}`
          );
        }

        availableProvider.invalidate();
        installedProvider.refresh();
      } catch (err) {
        vscode.window.showErrorMessage(
          `Install failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  );
}
