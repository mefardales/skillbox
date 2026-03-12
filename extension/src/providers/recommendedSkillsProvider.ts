/**
 * TreeDataProvider for the "Recommended Skills" view.
 *
 * Scans the workspace to detect the tech stack and recommends
 * matching skills from the registry. Shows detected technologies
 * as parent nodes with their recommended skills as children.
 */

import * as vscode from "vscode";
import type { Skill } from "../lib/types";
import { fetchRegistry } from "../lib/registry";
import { isInstalled } from "../lib/installer";
import { detectWorkspaceStack, DetectedStack } from "../lib/stackDetector";

// ---------------------------------------------------------------------------
// Tree item classes
// ---------------------------------------------------------------------------

export class StackItem extends vscode.TreeItem {
  constructor(
    public readonly stack: DetectedStack,
    public readonly matchCount: number
  ) {
    super(stack.name, vscode.TreeItemCollapsibleState.Expanded);

    this.contextValue = "detectedStack";
    this.description = stack.signal;
    this.iconPath = new vscode.ThemeIcon(stackIcon(stack.name));
    this.tooltip = `Detected: ${stack.name} (${stack.signal})\n${matchCount} skill${matchCount !== 1 ? "s" : ""} recommended`;
  }
}

export class RecommendedSkillItem extends vscode.TreeItem {
  constructor(public readonly skill: Skill, public readonly installed: boolean) {
    super(skill.name, vscode.TreeItemCollapsibleState.None);

    this.contextValue = "skill";
    this.description = installed ? "$(check) installed" : skill.version;
    this.tooltip = new vscode.MarkdownString(
      [
        `**${skill.name}** v${skill.version}`,
        ``,
        skill.description,
        ``,
        skill.tags.length ? `*Tags:* ${skill.tags.join(", ")}` : "",
        `*Category:* ${skill.category}`,
      ]
        .filter((l) => l !== "")
        .join("\n")
    );
    this.iconPath = new vscode.ThemeIcon(
      installed ? "pass-filled" : "lightbulb"
    );
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

export class RecommendedSkillsProvider
  implements vscode.TreeDataProvider<StackItem | RecommendedSkillItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    StackItem | RecommendedSkillItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private stacks: DetectedStack[] = [];
  private skills: Skill[] = [];
  private loading = false;
  private error: string | null = null;

  constructor() {
    this.loadRecommendations();
  }

  refresh(): void {
    this.loadRecommendations();
  }

  invalidate(): void {
    this._onDidChangeTreeData.fire();
  }

  // ---------------------------------------------------------------------------
  // TreeDataProvider implementation
  // ---------------------------------------------------------------------------

  getTreeItem(element: StackItem | RecommendedSkillItem): vscode.TreeItem {
    return element;
  }

  async getChildren(
    element?: StackItem | RecommendedSkillItem
  ): Promise<(StackItem | RecommendedSkillItem)[]> {
    if (!element) {
      if (this.loading) {
        const item = new vscode.TreeItem("Scanning workspace...");
        item.iconPath = new vscode.ThemeIcon("loading~spin");
        return [item as StackItem];
      }

      if (this.error) {
        const item = new vscode.TreeItem("Failed to load recommendations");
        item.description = this.error;
        item.iconPath = new vscode.ThemeIcon("error");
        return [item as StackItem];
      }

      if (this.stacks.length === 0) {
        const item = new vscode.TreeItem("No stack detected");
        item.description = "Open a project to get recommendations";
        item.iconPath = new vscode.ThemeIcon("info");
        return [item as StackItem];
      }

      // Group by detected stack
      return this.stacks.map((stack) => {
        const matchingSkills = stack.skillIds.filter((id) =>
          this.skills.some((s) => s.id === id)
        );
        return new StackItem(stack, matchingSkills.length);
      });
    }

    if (element instanceof StackItem) {
      return element.stack.skillIds
        .map((id) => this.skills.find((s) => s.id === id))
        .filter((s): s is Skill => s !== undefined)
        .map((s) => new RecommendedSkillItem(s, isInstalled(s.id)));
    }

    return [];
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async loadRecommendations(): Promise<void> {
    this.loading = true;
    this.error = null;
    this._onDidChangeTreeData.fire();

    try {
      const [stacks, registry] = await Promise.all([
        detectWorkspaceStack(),
        fetchRegistry(),
      ]);
      this.stacks = stacks;
      this.skills = registry.skills;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Unknown error";
    } finally {
      this.loading = false;
      this._onDidChangeTreeData.fire();
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stackIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("react") || lower.includes("next")) return "browser";
  if (lower.includes("express") || lower.includes("fast") || lower.includes("django") || lower.includes("rails") || lower.includes("spring")) return "server";
  if (lower.includes("docker") || lower.includes("kubernetes") || lower.includes("terraform") || lower.includes("aws")) return "cloud";
  if (lower.includes("git")) return "git-merge";
  if (lower.includes("jest") || lower.includes("vitest") || lower.includes("playwright") || lower.includes("pytest")) return "beaker";
  if (lower.includes("postgres") || lower.includes("mongo") || lower.includes("redis") || lower.includes("elastic")) return "database";
  if (lower.includes("tailwind") || lower.includes("alpine") || lower.includes("htmx") || lower.includes("ionic")) return "paintcan";
  return "zap";
}
