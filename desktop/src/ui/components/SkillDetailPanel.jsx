import React, { useEffect, useState } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';
import { catColors, simpleMarkdown } from '@/lib/utils';

const categoryColors = {
  frontend: '#f97316',
  backend: '#3b82f6',
  data: '#14b8a6',
  devops: '#22c55e',
  testing: '#a855f7',
  general: '#6b7280',
  mobile: '#ef4444',
  security: '#eab308',
};

export default function SkillDetailPanel({ skill, activeProjectPath, onClose, onInstall }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!skill?.id) return;
    setLoading(true);
    electronAPI.getSkillContent(skill.id)
      .then(c => setContent(c || 'No content available.'))
      .catch(() => setContent('Failed to load content.'))
      .finally(() => setLoading(false));
  }, [skill?.id]);

  if (!skill) return null;

  const cat = skill.category || 'general';
  const color = categoryColors[cat] || categoryColors.general;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg z-50 bg-background border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: color }}
              >
                {cat[0].toUpperCase()}
              </div>
              <h2 className="text-base font-semibold text-foreground truncate">
                {skill.name}
              </h2>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4"
                style={{ borderColor: color, color }}
              >
                {cat}
              </Badge>
              {skill.version && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  v{skill.version}
                </Badge>
              )}
              {skill.isCustom && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  Custom
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Description */}
        {skill.description && (
          <div className="px-5 py-3 border-b border-border shrink-0">
            <p className="text-xs text-muted-foreground">{skill.description}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border shrink-0">
          {activeProjectPath && (
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={onInstall}>
              <Download className="w-3.5 h-3.5" />
              Install to Project
            </Button>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="px-5 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-xs">
                Loading...
              </div>
            ) : (
              <div
                className="prose prose-invert prose-sm max-w-none text-sm text-foreground
                  [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mb-3 [&_h1]:mt-4
                  [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3
                  [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-3
                  [&_p]:text-xs [&_p]:leading-relaxed [&_p]:mb-2
                  [&_code]:text-[11px] [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded
                  [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:text-[11px] [&_pre]:overflow-x-auto
                  [&_ul]:text-xs [&_ul]:pl-4 [&_ul]:mb-2
                  [&_ol]:text-xs [&_ol]:pl-4 [&_ol]:mb-2
                  [&_li]:mb-0.5"
                dangerouslySetInnerHTML={{ __html: simpleMarkdown(content) }}
              />
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
