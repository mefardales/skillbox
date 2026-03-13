import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Tree } from 'react-arborist';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  FileCode,
  FileJson,
  FileImage,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  FolderPlus,
  FilePlus,
  X,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── File icon helpers ──────────────────────────────────────────
const EXT_COLORS = {
  js: 'text-yellow-400', mjs: 'text-yellow-400', cjs: 'text-yellow-400',
  jsx: 'text-blue-400', tsx: 'text-blue-400',
  ts: 'text-blue-500', mts: 'text-blue-500',
  json: 'text-yellow-300', jsonc: 'text-yellow-300',
  md: 'text-gray-400', mdx: 'text-gray-400',
  css: 'text-purple-400', scss: 'text-pink-400', less: 'text-purple-300',
  html: 'text-orange-400', htm: 'text-orange-400',
  py: 'text-green-400', pyw: 'text-green-400',
  rs: 'text-orange-500', go: 'text-cyan-400',
  java: 'text-red-400', kt: 'text-purple-500',
  rb: 'text-red-500', php: 'text-indigo-400',
  sh: 'text-green-300', bash: 'text-green-300', bat: 'text-green-300',
  yml: 'text-red-300', yaml: 'text-red-300', toml: 'text-red-300',
  sql: 'text-yellow-500',
  svg: 'text-orange-300', png: 'text-green-300', jpg: 'text-green-300',
  gif: 'text-green-300', ico: 'text-green-300', webp: 'text-green-300',
  env: 'text-yellow-600', lock: 'text-gray-500',
  txt: 'text-gray-400', log: 'text-gray-500', csv: 'text-green-400',
  vue: 'text-green-500', svelte: 'text-orange-400',
  dart: 'text-blue-400', swift: 'text-orange-500', c: 'text-blue-300',
  cpp: 'text-blue-400', h: 'text-purple-300', cs: 'text-green-500',
};
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp']);
const CODE_EXTS = new Set(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'mts', 'py', 'rs', 'go', 'java', 'kt', 'rb', 'php', 'sh', 'bash', 'bat', 'css', 'scss', 'less', 'html', 'htm', 'sql', 'c', 'cpp', 'h', 'cs', 'swift', 'dart', 'vue', 'svelte']);
const DATA_EXTS = new Set(['json', 'jsonc', 'yml', 'yaml', 'toml', 'xml', 'csv', 'env', 'lock']);

function getExt(name) {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function FileIcon({ name, className = 'w-3.5 h-3.5' }) {
  const ext = getExt(name);
  const color = EXT_COLORS[ext] || 'text-muted-foreground';
  let Icon = File;
  if (IMAGE_EXTS.has(ext)) Icon = FileImage;
  else if (DATA_EXTS.has(ext)) Icon = FileJson;
  else if (CODE_EXTS.has(ext)) Icon = FileCode;
  else if (ext === 'md' || ext === 'mdx' || ext === 'txt' || ext === 'log') Icon = FileText;
  return <Icon className={cn(className, color)} />;
}

function basename(p) {
  return p.replace(/\\/g, '/').split('/').filter(Boolean).pop() || p;
}

function parentPath(p) {
  const parts = p.replace(/\\/g, '/').split('/');
  parts.pop();
  return parts.join('/');
}

const ROW_HEIGHT = 22;

// Count visible nodes in tree (respecting open state from arborist)
function countVisibleNodes(data, openState) {
  if (!data) return 0;
  let count = 0;
  for (const entry of data) {
    count++;
    if (entry.isDir && entry.children && openState.has(entry.path)) {
      count += countVisibleNodes(entry.children, openState);
    }
  }
  return count;
}

// ── Node renderer for react-arborist ───────────────────────────
function Node({ node, style, dragHandle }) {
  const isDir = node.data.isDir;
  const name = node.data.name;
  const indent = node.level * 16;

  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        'group flex items-center h-full cursor-pointer text-[13px] pr-2',
        'hover:bg-accent/50',
        node.isSelected && 'bg-accent',
        node.willReceiveDrop && 'bg-primary/10 outline outline-1 outline-primary/40',
        node.isDragging && 'opacity-40',
      )}
      onClick={(e) => {
        e.stopPropagation();
        if (node.isInternal) node.toggle();
      }}
      onDoubleClick={() => {
        if (node.isLeaf) electronAPI.openFileInEditor?.(node.id);
      }}
    >
      <div style={{ width: indent }} className="shrink-0" />
      {isDir ? (
        <span className="flex items-center justify-center w-4 h-4 shrink-0"
          onClick={(e) => { e.stopPropagation(); node.toggle(); }}
        >
          {node.isOpen
            ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        </span>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <span className="flex items-center justify-center w-4 h-4 shrink-0 mr-1">
        {isDir ? (
          node.isOpen
            ? <FolderOpen className="w-4 h-4 text-muted-foreground" />
            : <Folder className="w-4 h-4 text-muted-foreground" />
        ) : (
          <FileIcon name={name} />
        )}
      </span>
      {node.isEditing ? (
        <RenameInput node={node} />
      ) : (
        <span className="truncate text-foreground select-none">{name}</span>
      )}
    </div>
  );
}

function RenameInput({ node }) {
  const inputRef = useRef(null);
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      const name = node.data.name;
      if (!node.data.isDir && name.includes('.')) {
        inputRef.current.setSelectionRange(0, name.lastIndexOf('.'));
      } else {
        inputRef.current.select();
      }
    }
  }, [node.data.name, node.data.isDir]);

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={node.data.name}
      className="flex-1 h-[18px] min-w-0 text-[12px] bg-accent border border-primary/50 rounded-sm px-1 outline-none text-foreground"
      onBlur={() => node.reset()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') node.reset();
        if (e.key === 'Enter') node.submit(e.currentTarget.value);
      }}
    />
  );
}

// ── Project section header ─────────────────────────────────────
function ProjectHeader({ project, isActive, isOpen, onToggle, onSelect, onContextMenu, isLoading }) {
  return (
    <div
      className={cn(
        'sticky top-0 z-10 flex items-center h-[22px] cursor-pointer text-[11px] font-semibold tracking-wider uppercase',
        'border-t border-border bg-background hover:bg-accent/50 shrink-0',
        isActive && 'bg-accent/30'
      )}
      onClick={() => { onSelect(project.path); onToggle(); }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, project); }}
    >
      <span className="flex items-center justify-center w-4 h-4 shrink-0 ml-0.5">
        {isLoading ? (
          <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
        ) : isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </span>
      <span className="truncate text-muted-foreground px-1">
        {project.name || basename(project.path)}
      </span>
    </div>
  );
}

// ── Single project tree ────────────────────────────────────────
function ProjectTree({ project, isActive, onSelect, onProjectContextMenu }) {
  const { toast } = useToast();
  const treeRef = useRef(null);
  const [treeData, setTreeData] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Track which folders are open so we can count visible rows
  const [openDirs, setOpenDirs] = useState(new Set());

  const loadTree = useCallback(async () => {
    setIsLoading(true);
    try {
      const entries = await electronAPI.readDirectory(project.path, 1);
      setTreeData(entries || []);
    } catch {
      setTreeData([]);
    } finally {
      setIsLoading(false);
    }
  }, [project.path]);

  const handleToggle = useCallback(() => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !treeData) loadTree();
  }, [isOpen, treeData, loadTree]);

  useEffect(() => {
    if (isActive && !isOpen) {
      setIsOpen(true);
      if (!treeData) loadTree();
    }
  }, [isActive]); // intentionally minimal

  // -- react-arborist handlers --

  const childrenAccessor = useCallback((d) => {
    if (!d.isDir) return null;
    return d.children || null;
  }, []);

  // Lazy-load children when a folder is toggled
  const handleToggleNode = useCallback(async (id) => {
    // Track open/close state
    setOpenDirs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    // Deep search and load children if needed
    const loadInTree = async (entries) => {
      let changed = false;
      const result = [];
      for (const entry of entries) {
        if (entry.path === id && entry.isDir && !entry.children) {
          try {
            const children = await electronAPI.readDirectory(entry.path, 1);
            result.push({ ...entry, children: children || [] });
            changed = true;
          } catch {
            result.push({ ...entry, children: [] });
            changed = true;
          }
        } else if (entry.children) {
          const [nc, c] = await loadInTree(entry.children);
          result.push(c ? { ...entry, children: nc } : entry);
          if (c) changed = true;
        } else {
          result.push(entry);
        }
      }
      return [result, changed];
    };

    if (treeData) {
      const [newData, changed] = await loadInTree(treeData);
      if (changed) setTreeData(newData);
    }
  }, [treeData]);

  const handleRename = useCallback(async ({ id, name }) => {
    const dir = parentPath(id);
    const newPath = dir + '/' + name;
    try {
      await electronAPI.renamePath(id, newPath);
      updateNodeInTree(id, (entry) => ({ ...entry, name, path: newPath }));
      toast(`Renamed to ${name}`, 'success');
    } catch (err) {
      toast(`Rename failed: ${err.message || err}`, 'error');
    }
  }, [toast]);

  const handleDelete = useCallback(async ({ ids }) => {
    for (const id of ids) {
      try {
        await electronAPI.deletePath(id);
        toast(`Deleted ${basename(id)}`, 'success');
      } catch (err) {
        toast(`Delete failed: ${err.message || err}`, 'error');
      }
    }
    const parents = new Set(ids.map(parentPath));
    await reloadDirs(parents);
  }, [toast]);

  const handleMove = useCallback(async ({ dragIds, parentId }) => {
    const destDir = parentId || project.path;
    for (const srcPath of dragIds) {
      try {
        await electronAPI.movePath(srcPath, destDir);
        toast(`Moved ${basename(srcPath)}`, 'success');
      } catch (err) {
        toast(`Move failed: ${err.message || err}`, 'error');
      }
    }
    const parents = new Set(dragIds.map(parentPath));
    parents.add(destDir);
    await reloadDirs(parents);
  }, [project.path, toast]);

  const handleCreate = useCallback(async ({ parentId, type }) => {
    const dir = parentId || project.path;
    const isFolder = type === 'internal';
    const name = isFolder ? 'new-folder' : 'new-file';
    const fullPath = dir + '/' + name;
    try {
      if (isFolder) await electronAPI.createFolder(fullPath);
      else await electronAPI.createFile(fullPath);
      await reloadDir(dir);
      toast(`Created ${name}`, 'success');
      return { id: fullPath, name, path: fullPath, isDir: isFolder, children: isFolder ? [] : undefined };
    } catch (err) {
      toast(`Create failed: ${err.message || err}`, 'error');
      return null;
    }
  }, [project.path, toast]);

  const handleContextMenu = useCallback(async (e) => {
    e.preventDefault();
    const node = treeRef.current?.focusedNode || treeRef.current?.selectedNodes?.[0];
    if (!node) return;

    const isDir = node.data.isDir;
    const items = [];
    if (isDir) {
      items.push(
        { label: 'New File...', action: 'newFile' },
        { label: 'New Folder...', action: 'newFolder' },
        { type: 'separator' },
      );
    }
    items.push(
      { label: 'Rename', action: 'rename', accelerator: 'F2' },
      { label: 'Delete', action: 'delete', accelerator: 'Delete' },
      { type: 'separator' },
      { label: 'Copy Path', action: 'copyPath' },
      { label: 'Copy Relative Path', action: 'copyRelPath' },
      { type: 'separator' },
      { label: 'Reveal in File Explorer', action: 'reveal' },
    );

    const action = await electronAPI.showContextMenu(items);
    if (!action) return;

    switch (action) {
      case 'newFile': if (isDir) { node.open(); treeRef.current?.createLeaf(node.id); } break;
      case 'newFolder': if (isDir) { node.open(); treeRef.current?.createInternal(node.id); } break;
      case 'rename': node.edit(); break;
      case 'delete': treeRef.current?.delete(node.id); break;
      case 'copyPath': await electronAPI.copyPath(node.id); toast('Path copied', 'success'); break;
      case 'copyRelPath': await electronAPI.copyRelativePath(node.id, project.path); toast('Relative path copied', 'success'); break;
      case 'reveal': await electronAPI.revealInFinder(node.id); break;
    }
  }, [project.path, toast]);

  // Tree state helpers
  const updateNodeInTree = useCallback((targetPath, updater) => {
    const update = (entries) =>
      entries.map((e) => {
        if (e.path === targetPath) return updater(e);
        if (e.children) return { ...e, children: update(e.children) };
        return e;
      });
    setTreeData((prev) => prev ? update(prev) : prev);
  }, []);

  const reloadDir = useCallback(async (dirPath) => {
    try {
      const entries = await electronAPI.readDirectory(dirPath, 1);
      if (dirPath === project.path) {
        setTreeData(entries || []);
      } else {
        updateNodeInTree(dirPath, (e) => ({ ...e, children: entries || [] }));
      }
    } catch { /* ignore */ }
  }, [project.path, updateNodeInTree]);

  const reloadDirs = useCallback(async (dirs) => {
    for (const d of dirs) await reloadDir(d);
  }, [reloadDir]);

  // Calculate exact height = visible rows * ROW_HEIGHT (no scrollbar per tree)
  const visibleCount = useMemo(() => {
    if (!isOpen || !treeData) return 0;
    return countVisibleNodes(treeData, openDirs);
  }, [isOpen, treeData, openDirs]);

  const treeHeight = visibleCount * ROW_HEIGHT;

  return (
    <div>
      <ProjectHeader
        project={project}
        isActive={isActive}
        isOpen={isOpen}
        onToggle={handleToggle}
        onSelect={onSelect}
        onContextMenu={onProjectContextMenu}
        isLoading={isLoading}
      />
      {isOpen && treeData && treeHeight > 0 && (
        <div onContextMenu={handleContextMenu}>
          <Tree
            ref={treeRef}
            data={treeData}
            idAccessor="path"
            childrenAccessor={childrenAccessor}
            onToggle={handleToggleNode}
            onRename={handleRename}
            onDelete={handleDelete}
            onMove={handleMove}
            onCreate={handleCreate}
            onActivate={(node) => {
              if (node.isLeaf) electronAPI.openFileInEditor?.(node.id);
            }}
            width="100%"
            height={treeHeight}
            rowHeight={ROW_HEIGHT}
            indent={16}
            openByDefault={false}
            selectionFollowsFocus
            disableDrop={(args) => {
              if (args.parentNode && !args.parentNode.data.isDir) return true;
              return false;
            }}
          >
            {Node}
          </Tree>
        </div>
      )}
      {isOpen && treeData && treeData.length === 0 && (
        <div className="text-[11px] text-muted-foreground italic py-1 pl-6">Empty</div>
      )}
      {isOpen && !treeData && isLoading && (
        <div className="flex items-center gap-2 px-4 py-1.5">
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">Loading...</span>
        </div>
      )}
    </div>
  );
}

// ── Main Sidebar Component ─────────────────────────────────────
export function ProjectSidebar() {
  const { projects, activeProjectPath, setActiveProjectPath, refreshProjects } = useStore();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [addingProject, setAddingProject] = useState(false);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter((p) =>
      (p.name || basename(p.path)).toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  const handleSelectProject = useCallback((projectPath) => {
    setActiveProjectPath(projectPath);
  }, [setActiveProjectPath]);

  const handleAddProject = useCallback(async () => {
    try {
      const dir = await electronAPI.browseFolder();
      if (!dir) return;
      setAddingProject(true);
      toast('Loading project...', 'info');
      const result = await electronAPI.addProject(dir);
      await refreshProjects();
      setActiveProjectPath(dir);
      if (result?.isNew === false) {
        toast('Project already in workspace', 'info');
      } else {
        toast(`Added "${basename(dir)}" to workspace`, 'success');
      }
    } catch (err) {
      toast(`Failed to add project: ${err.message || err}`, 'error');
    } finally {
      setAddingProject(false);
    }
  }, [refreshProjects, setActiveProjectPath, toast]);

  const handleProjectContextMenu = useCallback(async (e, project) => {
    e.preventDefault();
    const items = [
      { label: 'New File...', action: 'newFile' },
      { label: 'New Folder...', action: 'newFolder' },
      { type: 'separator' },
      { label: 'Copy Path', action: 'copyPath' },
      { label: 'Reveal in File Explorer', action: 'reveal' },
      { type: 'separator' },
      { label: 'Refresh', action: 'refresh' },
      { type: 'separator' },
      { label: 'Remove from Workspace', action: 'remove' },
    ];

    const action = await electronAPI.showContextMenu(items);
    if (!action) return;

    switch (action) {
      case 'copyPath': await electronAPI.copyPath(project.path); toast('Path copied', 'success'); break;
      case 'reveal': await electronAPI.revealInFinder(project.path); break;
      case 'refresh': toast('Refreshed', 'info'); break;
      case 'remove':
        await electronAPI.removeProject(project.path);
        await refreshProjects();
        toast(`Removed ${basename(project.path)}`, 'info');
        break;
    }
  }, [refreshProjects, toast]);

  return (
    <div className="flex flex-col h-full bg-background border-r border-border w-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between h-[35px] px-3 shrink-0 border-b border-border">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Explorer
        </span>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5"
                onClick={() => toast('Refreshed', 'info')}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Refresh Explorer</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5">
                <FilePlus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New File</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5">
                <FolderPlus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New Folder</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5"
                onClick={handleAddProject}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Add Project</TooltipContent>
          </Tooltip>
        </div>
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
            {searchQuery && (
              <button
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {addingProject && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-accent/30 shrink-0">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span className="text-[11px] text-muted-foreground">Loading project...</span>
        </div>
      )}

      {/* Tree container — single scrollable area for ALL projects */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {filteredProjects.length === 0 && !addingProject ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
            <Folder className="h-8 w-8 opacity-40" />
            <span className="text-[12px]">No projects yet</span>
            <Button variant="outline" size="sm" className="text-[12px] h-7" onClick={handleAddProject}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Project
            </Button>
          </div>
        ) : (
          filteredProjects.map((project) => (
            <ProjectTree
              key={project.path}
              project={project}
              isActive={activeProjectPath === project.path}
              onSelect={handleSelectProject}
              onProjectContextMenu={handleProjectContextMenu}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default ProjectSidebar;
