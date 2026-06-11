'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Clipboard,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CommandCenterSurface } from '@/components/command-center/CommandCenterSurface';

type PasteItem = {
  id: string;
  content: string;
  createdAt: string;
  source: string;
};

const PASTE_LIMIT = 20;

function formatAge(createdAt: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));

  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  return `${Math.floor(minutes / 60)}h ago`;
}

function getPreview(content: string) {
  return content.replace(/\s+/g, ' ').slice(0, 140);
}

export function CrossPlatformClipboard() {
  const [draft, setDraft] = useState('');
  const [pastes, setPastes] = useState<PasteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadPastes = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);

    try {
      const res = await fetch('/api/paste-bin', {
        cache: 'no-store',
      });
      const data = await res.json();

      if (!data.success) {
        console.error('[Paste Bin Load Error]:', data.error, data.details || '');
        toast.error(data.error || 'Unable to load recent pastes');
        return;
      }

      setPastes(data.data);
    } catch (error) {
      console.error('[Paste Bin Network Error]:', error);
      toast.error('Unable to load recent pastes');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPastes();
  }, [loadPastes]);

  useEffect(() => {
    const interval = window.setInterval(() => loadPastes(true), 8000);
    return () => window.clearInterval(interval);
  }, [loadPastes]);

  const handleNativePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();

      if (!text.trim()) {
        console.error('[Clipboard Empty Error]: navigator.clipboard.readText returned an empty value');
        toast.error('Clipboard is empty');
        return;
      }

      setDraft(text);
      toast.success('Clipboard text loaded');
    } catch (error) {
      console.error('[Clipboard Read Error]:', error);
      toast.error('Browser blocked clipboard read. Paste with Cmd/Ctrl+V instead.');
    }
  }, []);

  const handleSave = async () => {
    const content = draft.trim();

    if (!content) return;

    setIsSaving(true);

    try {
      const res = await fetch('/api/paste-bin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, source: navigator.platform || 'web' }),
      });
      const data = await res.json();

      if (!data.success) {
        console.error('[Paste Bin Save Error]:', data.error, data.details || '');
        toast.error(data.error || 'Unable to save paste');
        return;
      }

      setPastes((current) => [data.data, ...current.filter((item) => item.id !== data.data.id)].slice(0, PASTE_LIMIT));
      setDraft('');
      toast.success('Paste saved for your other devices');
    } catch (error) {
      console.error('[Paste Bin Save Network Error]:', error);
      toast.error('Unable to save paste');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async (item: PasteItem) => {
    try {
      await navigator.clipboard.writeText(item.content);
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(null), 1200);
      toast.success('Copied to clipboard');
    } catch (error) {
      console.error('[Clipboard Write Error]:', error);
      toast.error('Browser blocked clipboard copy');
    }
  };

  const handleClear = async () => {
    try {
      const res = await fetch('/api/paste-bin', {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!data.success) {
        console.error('[Paste Bin Clear Error]:', data.error, data.details || '');
        toast.error(data.error || 'Unable to clear recent pastes');
        return;
      }

      setPastes([]);
      toast.success('Recent pastes cleared');
    } catch (error) {
      console.error('[Paste Bin Clear Network Error]:', error);
      toast.error('Unable to clear recent pastes');
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <CommandCenterSurface className="rounded-lg p-4 md:p-5">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-md bg-cyan-300/15 text-cyan-100">
                <ClipboardCheck className="size-5" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200/80">Device Relay</p>
                <h1 className="mt-1 text-3xl font-black tracking-normal text-white md:text-5xl">Universal Paste</h1>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
              Send text, prompts, links, and snippets to your other devices without creating long-term database history.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => loadPastes()}
            disabled={isLoading}
            className="h-10 rounded-md border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]"
            title="Refresh recent pastes"
          >
            <RefreshCw className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-3">
          <div className="overflow-hidden rounded-lg border border-white/10 bg-black/25">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              <span>Composer</span>
              <span>{draft.length.toLocaleString()} / 12,000</span>
            </div>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Paste text, links, notes, prompts, or snippets here..."
              className="h-56 w-full resize-none bg-transparent px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-slate-600"
              maxLength={12000}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-3 py-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <ShieldCheck className="size-3.5 text-emerald-300" />
                Redis only, capped at {PASTE_LIMIT}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={handleNativePaste}
                  variant="outline"
                  className="h-10 rounded-md border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]"
                >
                  <Clipboard />
                  Paste
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={!draft.trim() || isSaving}
                  className="h-10 rounded-md bg-cyan-300 px-4 font-black text-slate-950 hover:bg-cyan-200"
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : <ExternalLink />}
                  Send
                </Button>
              </div>
            </div>
          </div>

          <CommandCenterSurface className="rounded-lg border-white/10 bg-black/20 p-3 shadow-none">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              <span>Recent Relay</span>
              <button
                type="button"
                onClick={handleClear}
                disabled={!pastes.length}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] normal-case tracking-normal text-slate-400 transition hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-100 disabled:opacity-40"
              >
                <Trash2 className="size-3" />
                Clear
              </button>
            </div>

            <AnimatePresence initial={false}>
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid gap-2"
                >
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="h-20 animate-pulse rounded-lg bg-white/[0.06]" />
                  ))}
                </motion.div>
              ) : pastes.length ? (
                <motion.div layout className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1">
                  {pastes.map((item) => (
                    <motion.div
                      layout
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="group grid gap-3 rounded-lg border border-white/10 bg-white/[0.055] p-3 transition hover:border-cyan-300/30 hover:bg-white/[0.08]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 break-words text-sm leading-6 text-slate-200">
                          {getPreview(item.content)}
                          {item.content.length > 140 && <span className="text-slate-500">...</span>}
                        </p>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          onClick={() => handleCopy(item)}
                          className="shrink-0 rounded-md border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]"
                          title="Copy this paste"
                        >
                          {copiedId === item.id ? <Check className="text-emerald-300" /> : <Copy />}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="truncate">From {item.source}</span>
                        <span>{formatAge(item.createdAt)}</span>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-lg border border-dashed border-white/15 bg-white/[0.035] px-4 py-10 text-center text-sm text-slate-500"
                >
                  Nothing here yet. Send a paste from this device, then open Cleon somewhere else.
                </motion.div>
              )}
            </AnimatePresence>
          </CommandCenterSurface>
        </div>
      </CommandCenterSurface>

      <aside className="grid gap-4 lg:content-start">
        <CommandCenterSurface className="rounded-lg p-4">
          <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-200/80">
            <Zap className="size-4" />
            Relay Status
          </div>
          <div className="grid grid-cols-2 gap-2">
            <RelayMetric label="Items" value={pastes.length} />
            <RelayMetric label="Limit" value={PASTE_LIMIT} />
            <RelayMetric label="Chars" value={draft.length} />
            <RelayMetric label="Poll" value={8} suffix="s" />
          </div>
        </CommandCenterSurface>
        <CommandCenterSurface className="rounded-lg p-4">
          <p className="text-sm font-bold text-white">Operating logic</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            This relay is intentionally temporary. It is for moving working context between devices, not archiving knowledge.
          </p>
        </CommandCenterSurface>
      </aside>
    </div>
  );
}

function RelayMetric({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-2xl font-black text-white">
        {value}
        {suffix}
      </p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
    </div>
  );
}
