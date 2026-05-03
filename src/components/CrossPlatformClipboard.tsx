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
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

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
  return content.replace(/\s+/g, ' ').slice(0, 120);
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
    <div className="relative overflow-hidden rounded-[2rem] border border-white/50 bg-white/65 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/70 dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.24),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(236,72,153,0.18),transparent_34%)]" />

      <div className="relative flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/20 dark:bg-white dark:text-slate-950">
                <ClipboardCheck className="size-4" />
              </span>
              <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                Universal Paste
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Paste here, then open the base website from any device to copy the same recent history. Recent pastes live in Redis for a short time and are capped at {PASTE_LIMIT}.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadPastes()}
              disabled={isLoading}
              className="rounded-full bg-white/60 dark:bg-white/5"
              title="Refresh recent pastes"
            >
              <RefreshCw className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-2 shadow-inner dark:border-white/10 dark:bg-white/[0.04]">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Paste text, links, notes, prompts, or snippets here..."
              className="h-36 w-full resize-none rounded-xl bg-transparent px-3 py-3 text-sm leading-6 text-slate-950 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
              maxLength={12000}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 px-2 pt-2 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
              <span>{draft.length.toLocaleString()} / 12,000 characters</span>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-emerald-500" />
                Redis only, no database history
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:w-36 md:grid-cols-1">
            <Button
              type="button"
              onClick={handleNativePaste}
              variant="outline"
              className="h-12 rounded-2xl bg-white/70 dark:bg-white/5"
            >
              <Clipboard />
              Paste
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!draft.trim() || isSaving}
              className="h-12 rounded-2xl bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <ExternalLink />}
              Send
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/70 bg-slate-950/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            <span>Recent Pastes</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                disabled={!pastes.length}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] normal-case tracking-normal text-slate-600 transition hover:bg-white/70 hover:text-slate-950 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <Trash2 className="size-3" />
                Clear
              </button>
            </div>
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
                  <div key={item} className="h-16 animate-pulse rounded-xl bg-white/70 dark:bg-white/5" />
                ))}
              </motion.div>
            ) : pastes.length ? (
              <motion.div layout className="grid max-h-80 gap-2 overflow-y-auto pr-1">
                {pastes.map((item) => (
                  <motion.div
                    layout
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="group grid gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3 shadow-sm transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-slate-950/70 dark:hover:border-white/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words text-sm leading-6 text-slate-800 dark:text-slate-100">
                        {getPreview(item.content)}
                        {item.content.length > 120 && <span className="text-slate-400">...</span>}
                      </p>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        onClick={() => handleCopy(item)}
                        className="shrink-0 rounded-full bg-white/80 dark:bg-white/5"
                        title="Copy this paste"
                      >
                        {copiedId === item.id ? <Check className="text-emerald-500" /> : <Copy />}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
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
                className="rounded-xl border border-dashed border-slate-300 bg-white/50 px-4 py-6 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-white/[0.03] dark:text-slate-400"
              >
                Nothing here yet. Send a paste from any device, then open the base website somewhere else.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
