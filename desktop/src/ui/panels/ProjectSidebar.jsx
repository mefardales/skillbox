import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useStore } from '@/hooks/useStore';
import { electronAPI } from '@/lib/electronAPI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Folder,
  FolderOpen,
  File,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// --- File type icon helper ---
const FILE_ICON_COLORS = {
  js: 'text-yellow-400',
  jsx: 'text-blue-400',
  ts: 'text-blue-500',
  tsx: 'text-blue-400',
  json: 'text-yellow-300',
  md: 'text-gray-400',
  css: 'text-purple-400',
  html: 'text-orange-400',
  py: 'text-green-400',
  rs: 'text-orange-500',
  go: 'text-cyan-400',
};

function getFileIconColor(name) {
  const ext = name.split('.').pop()?.toLowerCase();
  return FILE_ICON_COLORS[ext] || 'text-muted-foreground';
}

function basename(p) {
  return p.split(/[/\\]/).filter(Boolean).pop() || p;
}

// --- Tree Node (recursive) ---
function TreeNode({ entry, depth, expandedPaths, onToggleDir, onFileClick }) {
  const isExpanded = expandedPaths.has(entry.path);
  const indent = depth * 16;

  if (entry.isDir) {
    return (
      <div>
        <div
          className="group flex items-center h-[22px] cursor-pointer hover:bg-accent/50 text-[13px]"
          style={{ paddingLeft: `${indent}px` }}
          onClick={() => onToggleDir(entry.path)}
          onContextMenu={(e) => {
            e.preventDefault();
            // Context menu hook point — extend as needed
          }}
        >
          <span className="flex items-center justify-center w-4 h-4 shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </span>
          <span className="flex items-center justify-center w-4 h-4 shrink-0 mr-1">
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Folder className="w-4 h-4 text-muted-foreground" />
            )}
          </span>
          <span className="truncate text-foreground">{entry.name}</span>
        </div>
        {isExpanded && (
          <div>
            {entry.children ? (
              entry.children.length > 0 ? (
                entry.children.map((child) => (
                  <TreeNode
                    key={child.path}
                    entry={child}
                    depth={depth + 1}
                    expandedPaths={expandedPaths}
                    onToggleDir={onToggleDir}
                    onFileClick={onFileClick}
                  />
                ))
              ) : (
                <div
                  className="text-[12px] text-muted-foreground italic h-[22px] flex items-center"
                  style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
                >
                  Empty
                </div>
              )
            ) : (
              <div
                className="text-[12px] text-muted-foreground h-[22px] flex items-center"
                style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
              >
                Loading...
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="group flex items-center h-[22px] cursor-pointer hover:bg-accent/50 text-[13px]"
      style={{ paddingLeft: `${indent + 16}px` }}
      onClick={() => onFileClick(entry.path)}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
    >
      <span className={cn('flex items-center justify-center w-4 h-4 shrink-0 mr-1', getFileIconColor(entry.name))}>
        <File className="w-3.5 h-3.5" />
      </span>
      <span className="truncate text-foreground">{entry.name}</span>
    </div>
  );
}

// --- Project Section ---
function ProjectSection({ project, isActive, expandedPaths, onSelect, onToggleProject, onToggleDir, onFileClick, onContextMenu }) {
  const isExpanded = expandedPaths.has(project.path);

  return (
    <div>
      <div
        className={cn(
          'flex items-center h-[22px] cursor-pointer text-[11px] font-semibold tracking-wider uppercase',
          'hover:bg-accent/50',
          isActive && 'bg-accent'
        )}
        onClick={() => onSelect(project.path)}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(e, project.path);
        }}
      >
        <button
          className="flex items-center justify-center w-4 h-4 shrink-0 ml-0.5"
          onClick={(e) => {
            e.stopPropagation();
            onToggleProject(project.path);
          }}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
        <span className="truncate text-muted-foreground px-1">
          {basename(project.path)}
        </span>
      </div>
      {isExpanded && project.tree && (
        <div>
          {project.tree.length > 0 ? (
            project.tree.map((entry) => (
              <TreeNode
                key={entry.path}
                entry={entry}
                depth={1}
                expandedPaths={expandedPaths}
                onToggleDir={onToggleDir}
                onFileClick={onFileClick}
              />
            ))
          ) : (
            <div className="text-[12px] text-muted-foreground italic h-[22px] flex items-center pl-6">
              Empty
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main Sidebar Component ---
export function ProjectSidebar() {
  const { projects, activeProjectPath, setActiveProjectPath, refreshProjects } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPaths, setExpandedPaths] = useState(new Set());
  const [treeCache, setTreeCache] = useState(new Map());

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter((p) =>
      basename(p.path).toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  // Toggle expand/collapse for a project root
  const handleToggleProject = useCallback(async (projectPath) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(projectPath)) {
        next.delete(projectPath);
      } else {
        next.add(projectPath);
      }
      return next;
    });

    // Select the project when expanding
    setActiveProjectPath(projectPath);

    // Load tree if not cached
    if (!expandedPaths.has(projectPath) && !treeCache.has(projectPath)) {
      try {
        const entries = await electronAPI.readDirectory(projectPath, 1);
        setTreeCache((prev) => {
          const next = new Map(prev);
          next.set(projectPath, entries);
          return next;
        });
      } catch {
        setTreeCache((prev) => {
          const next = new Map(prev);
          next.set(projectPath, []);
          return next;
        });
      }
    }
  }, [expandedPaths, treeCache, setActiveProjectPath]);

  // Toggle expand/collapse for a subdirectory
  const handleToggleDir = useCallback(async (dirPath) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });

    if (!expandedPaths.has(dirPath) && !treeCache.has(dirPath)) {
      try {
        const entries = await electronAPI.readDirectory(dirPath, 1);
        setTreeCache((prev) => {
          const next = new Map(prev);
          next.set(dirPath, entries);
          return next;
        });
      } catch {
        setTreeCache((prev) => {
          const next = new Map(prev);
          next.set(dirPath, []);
          return next;
        });
      }
    }
  }, [expandedPaths, treeCache]);

  // Select active project
  const handleSelectProject = useCallback((projectPath) => {
    setActiveProjectPath(projectPath);
  }, [setActiveProjectPath]);

  // Open file in editor
  const handleFileClick = useCallback((filePath) => {
    electronAPI.openFileInEditor?.(filePath);
  }, []);

  // Add new project via folder browser
  const handleAddProject = useCallback(async () => {
    try {
      const dir = await electronAPI.browseFolder();
      if (dir) {
        await electronAPI.addProject(dir);
      }
    } catch {
      // User cancelled or error
    }
  }, []);

  // Build tree data for each project, attaching children from cache
  const projectsWithTree = useMemo(() => {
    function attachChildren(entries) {
      if (!entries) return entries;
      return entries.map((entry) => {
        if (entry.isDir && expandedPaths.has(entry.path)) {
          const cached = treeCache.get(entry.path);
          return { ...entry, children: cached ? attachChildren(cached) : null };
        }
        return entry;
      });
    }

    return filteredProjects.map((p) => ({
      ...p,
      tree: expandedPaths.has(p.path)
        ? attachChildren(treeCache.get(p.path) || null)
        : null,
    }));
  }, [filteredProjects, expandedPaths, treeCache]);

  return (
    <div className="flex flex-col h-full bg-background border-r border-border w-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between h-[35px] px-3 shrink-0 border-b border-border">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Explorer
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={handleAddProject}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Add Project</TooltipContent>
        </Tooltip>
      </div>

      {/* Search */}
      {projects.length > 0 && (
        <div className="px-2 py-1.5 shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Filter projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-[26px] pl-7 text-[12px] bg-background border-border"
            />
          </div>
        </div>
      )}

      {/* Project List */}
      <ScrollArea className="flex-1">
        {projectsWithTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
            <Folder className="h-8 w-8 opacity-40" />
            <span className="text-[12px]">No projects yet</span>
            <Button
              variant="outline"
              size="sm"
              className="text-[12px] h-7"
              onClick={handleAddProject}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Project
            </Button>
          </div>
        ) : (
          <div className="py-0.5">
            {projectsWithTree.map((project) => (
              <ProjectSection
                key={project.path}
                project={project}
                isActive={activeProjectPath === project.path}
                expandedPaths={expandedPaths}
                onSelect={handleSelectProject}
                onToggleProject={handleToggleProject}
                onToggleDir={handleToggleDir}
                onFileClick={handleFileClick}
                onContextMenu={() => {}}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default ProjectSidebar;
