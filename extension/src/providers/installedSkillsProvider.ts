/**
 * TreeDataProvider for the "Installed Skills" view.
 *
 * Structure:
 *   Global
 *     [Skill]  (targets: claude, cursor)
 *   Project  (only shown when a workspace is open)
 *     [Skill]
 */

import * as vscode from "vscode";
import type { InstalledSkill } from "../lib/types";
import { loadInstalled } from "../lib/installer";

// ---------------------------------------------------------------------------
// Tree item classes
// ---------------------------------------------------------------------------

export class ScopeItem extends vscode.TreeItem {
  constructor(
    public readonly scope: "global" | "project",
    public readonly count: number
  ) {
    super(
      scope === "global" ? "Global" : "Project",
      count > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    this.contextValue = "scope";
    this.description = `${count} skill${count !== 1 ? "s" : ""}`;
    this.iconPath = new vscode.ThemeIcon(
      scope === "global" ? "home" : "folder-opened"
    );
    this.tooltip =
      scope === "global"
        ? "Skills installed globally (~/.{tool}/skills/)"
        : "Skills installed for this project";
  }
}

export class InstalledSkillItem extends vscode.TreeItem {
  constructor(public readonly record: InstalledSkill) {
    // Use the skill name portion (after the "/") as the label
    const parts = record.id.split("/");
    const displayName = parts[parts.length - 1]
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    super(displayName, vscode.TreeItemCollapsibleState.None);

    this.contextValue = "installedSkill";

    // Show the tools it's installed to as description
    this.description = record.targets.join(", ");

    const installedDate = new Date(record.installedAt).toLocaleDateString();
    this.tooltip = new vscode.MarkdownString(
      [
        `**${displayName}** v${record.version}`,
        ``,
        `*ID:* \`${record.id}\``,
        `*Installed:* ${installedDate}`,
        `*Scope:* ${record.global ? "global" : "project"}`,
        `*Tools:* ${record.targets.join(", ")}`,
      ].join("\n")
    );

    this.iconPath = new vscode.ThemeIcon("pass-filled");

    // Single-click opens preview
    this.command = {
      command: "skillbox.preview",
      title: "Preview Skill",
      arguments: [this],
    };
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class InstalledSkillsProvider
  implements vscode.TreeDataProvider<ScopeItem | InstalledSkillItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    ScopeItem | InstalledSkillItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  // ---------------------------------------------------------------------------
  // TreeDataProvider implementation
  // ---------------------------------------------------------------------------

  getTreeItem(
    element: ScopeItem | InstalledSkillItem
  ): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: ScopeItem | InstalledSkillItem
  ): (ScopeItem | InstalledSkillItem)[] {
    const installed = loadInstalled();

    if (!element) {
      if (installed.length === 0) {
        const empty = new vscode.TreeItem("No skills installed yet");
        empty.iconPath = new vscode.ThemeIcon("info");
        empty.tooltip =
          "Browse the Available Skills panel to install your first skill.";
        return [empty as ScopeItem];
      }

      const globals = installed.filter((s) => s.global);
      const projects = installed.filter((s) => !s.global);
      const items: ScopeItem[] = [new ScopeItem("global", globals.length)];
      if (projects.length > 0 || vscode.workspace.workspaceFolders?.length) {
        items.push(new ScopeItem("project", projects.length));
      }
      return items;
    }

    if (element instanceof ScopeItem) {
      const scoped = installed.filter((s) =>
        element.scope === "global" ? s.global : !s.global
      );

      if (scoped.length === 0) {
        const empty = new vscode.TreeItem("None installed");
        empty.iconPath = new vscode.ThemeIcon("circle-outline");
        return [empty as InstalledSkillItem];
      }

      return scoped.map((r) => new InstalledSkillItem(r));
    }

    return [];
  }
}
