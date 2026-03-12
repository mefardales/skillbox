/**
 * TreeDataProvider for the "Available Skills" view.
 *
 * Structure:
 *   [Category]
 *     [Skill]  (with install button, "(installed)" badge)
 *   ...
 *
 * Supports search/filter: when a query is set, flat list replaces category tree.
 */

import * as vscode from "vscode";
import type { Skill } from "../lib/types";
import {
  fetchRegistry,
  searchSkills,
  groupByCategory,
} from "../lib/registry";
import { isInstalled } from "../lib/installer";

// ---------------------------------------------------------------------------
// Tree item classes
// ---------------------------------------------------------------------------

export class CategoryItem extends vscode.TreeItem {
  constructor(
    public readonly category: string,
    public readonly skillCount: number
  ) {
    super(
      capitalize(category),
      vscode.TreeItemCollapsibleState.Expanded
    );

    this.contextValue = "category";
    this.description = `${skillCount} skill${skillCount !== 1 ? "s" : ""}`;
    this.iconPath = new vscode.ThemeIcon(categoryIcon(category));
    this.tooltip = `${capitalize(category)} skills`;
  }
}

export class SkillItem extends vscode.TreeItem {
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
        skill.tags.length
          ? `*Tags:* ${skill.tags.join(", ")}`
          : "",
        `*Author:* ${skill.author}`,
        `*Category:* ${skill.category}`,
      ]
        .filter((l) => l !== null)
        .join("\n")
    );
    this.iconPath = new vscode.ThemeIcon(
      installed ? "pass-filled" : "extensions"
    );
    // Pass skill as command argument for single-click preview
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

export class AvailableSkillsProvider
  implements vscode.TreeDataProvider<CategoryItem | SkillItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    CategoryItem | SkillItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private skills: Skill[] = [];
  private loading = false;
  private error: string | null = null;
  private searchQuery = "";

  constructor() {
    // Trigger initial load
    this.loadSkills();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  refresh(forceNetwork = false): void {
    this.loadSkills(forceNetwork);
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this._onDidChangeTreeData.fire();
  }

  clearSearch(): void {
    this.searchQuery = "";
    this._onDidChangeTreeData.fire();
  }

  /** Call this after an install/remove to update badges without network hit */
  invalidate(): void {
    this._onDidChangeTreeData.fire();
  }

  // ---------------------------------------------------------------------------
  // TreeDataProvider implementation
  // ---------------------------------------------------------------------------

  getTreeItem(element: CategoryItem | SkillItem): vscode.TreeItem {
    return element;
  }

  async getChildren(
    element?: CategoryItem | SkillItem
  ): Promise<(CategoryItem | SkillItem)[]> {
    // Top-level: return categories (or flat list when searching)
    if (!element) {
      if (this.loading) {
        const loading = new vscode.TreeItem("Loading skills...");
        loading.iconPath = new vscode.ThemeIcon("loading~spin");
        return [loading as CategoryItem];
      }

      if (this.error) {
        const err = new vscode.TreeItem(
          "Failed to load registry",
          vscode.TreeItemCollapsibleState.None
        );
        err.description = this.error;
        err.iconPath = new vscode.ThemeIcon("error");
        err.tooltip = this.error;
        err.command = {
          command: "skillbox.refresh",
          title: "Retry",
        };
        return [err as CategoryItem];
      }

      if (this.skills.length === 0) {
        const empty = new vscode.TreeItem("No skills found");
        empty.iconPath = new vscode.ThemeIcon("info");
        return [empty as CategoryItem];
      }

      // When searching: flat list
      if (this.searchQuery.trim()) {
        const filtered = searchSkills(this.skills, this.searchQuery);
        if (filtered.length === 0) {
          const none = new vscode.TreeItem(
            `No results for "${this.searchQuery}"`
          );
          none.iconPath = new vscode.ThemeIcon("search");
          return [none as CategoryItem];
        }
        return filtered.map(
          (s) => new SkillItem(s, isInstalled(s.id))
        );
      }

      // Normal: grouped by category
      const grouped = groupByCategory(this.skills);
      return Array.from(grouped.entries()).map(
        ([cat, list]) => new CategoryItem(cat, list.length)
      );
    }

    // Category node: return its skills
    if (element instanceof CategoryItem) {
      const grouped = groupByCategory(this.skills);
      const list = grouped.get(element.category) ?? [];
      return list.map((s) => new SkillItem(s, isInstalled(s.id)));
    }

    return [];
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async loadSkills(forceNetwork = false): Promise<void> {
    this.loading = true;
    this.error = null;
    this._onDidChangeTreeData.fire();

    try {
      const registry = await fetchRegistry(forceNetwork);
      this.skills = registry.skills;
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : "Unknown error loading registry";
    } finally {
      this.loading = false;
      this._onDidChangeTreeData.fire();
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function categoryIcon(category: string): string {
  switch (category.toLowerCase()) {
    case "frontend":
      return "browser";
    case "backend":
      return "server";
    case "devops":
      return "cloud";
    case "testing":
      return "beaker";
    case "general":
      return "star";
    default:
      return "folder";
  }
}
