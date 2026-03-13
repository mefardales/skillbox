import React, { useState, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Clock } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';
import { formatDate } from '@/lib/utils';

function isToday(date) {
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function isYesterday(date) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
}

function getDayLabel(date) {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return date.toLocaleDateString();
}

export default function HistoryView() {
  const { projects } = useStore();
  const { toast } = useToast();

  const [filter, setFilter] = useState('');
  const [history, setHistory] = useState([]);

  const loadHistory = useCallback(async (projectPath) => {
    const data = await electronAPI.getHistory(projectPath || undefined);
    setHistory(data || []);
  }, []);

  useEffect(() => {
    loadHistory(filter);
  }, [filter, loadHistory]);

  // Group events by day
  const grouped = [];
  let currentDay = '';
  for (const item of history) {
    const date = new Date(item.timestamp);
    const day = date.toLocaleDateString();
    if (day !== currentDay) {
      currentDay = day;
      grouped.push({ type: 'header', label: getDayLabel(date), key: day });
    }
    grouped.push({ type: 'event', data: item, key: item.id || item.timestamp });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">History</h2>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-7 px-2 text-xs bg-background border border-border rounded text-foreground"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.path} value={p.path}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-xs">No history events yet.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {grouped.map((entry) => {
                if (entry.type === 'header') {
                  return (
                    <div
                      key={entry.key}
                      className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-4 pb-2 first:pt-0"
                    >
                      {entry.label}
                    </div>
                  );
                }

                const item = entry.data;
                const date = new Date(item.timestamp);
                const time = date.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={entry.key}
                    className="flex items-start gap-3 py-2 group"
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        item.type === 'create'
                          ? 'bg-green-500'
                          : item.type === 'delete'
                            ? 'bg-red-500'
                            : item.type === 'update'
                              ? 'bg-blue-500'
                              : 'bg-muted-foreground'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug">
                        {item.detail}
                      </p>
                      {item.project && (
                        <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
                          {item.project}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                      {time}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
