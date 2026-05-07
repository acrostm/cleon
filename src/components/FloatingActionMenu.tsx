'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import {
  Bell,
  ChevronRight,
  ClipboardCheck,
  LayoutGrid,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { SubmitUrlForm } from './SubmitUrlForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  onSubmit: (url: string) => Promise<boolean>;
  isSubmitting: boolean;
}

const panelVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 18,
    scale: 0.96,
    filter: 'blur(8px)',
    transition: { duration: 0.16, ease: [0.4, 0, 0.2, 1] },
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 420,
      damping: 34,
      mass: 0.8,
      staggerChildren: 0.055,
      delayChildren: 0.04,
    },
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 500, damping: 36 },
  },
};

const iconFrameClass =
  'flex size-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm transition duration-300 group-hover/action:scale-105';

const actionRowClass =
  'group/action flex w-full items-center gap-3 rounded-2xl border border-white/70 bg-white/80 p-3 text-left shadow-[0_10px_28px_rgba(15,23,42,0.08)] outline-none transition duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-[0_16px_38px_rgba(15,23,42,0.13)] focus-visible:ring-3 focus-visible:ring-slate-400/30 dark:border-white/10 dark:bg-slate-900/80 dark:shadow-[0_14px_34px_rgba(0,0,0,0.32)] dark:hover:border-white/20 dark:hover:bg-slate-900';

export function FloatingActionMenu({ onSubmit, isSubmitting }: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleUrlSubmit = async (url: string) => {
    const success = await onSubmit(url);
    if (success) {
      setIsDialogOpen(false);
      setIsMenuOpen(false);
    }
  };

  const openCollectDialog = () => {
    setIsMenuOpen(false);
    setIsDialogOpen(true);
  };

  return (
    <>
      {!isDialogOpen && (
        <div className="fixed bottom-5 right-4 z-[60] flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                key="action-command-panel"
                id="action-command-panel"
                variants={panelVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="relative w-[min(calc(100vw-2rem),22rem)] overflow-hidden rounded-[1.75rem] border border-white/70 bg-slate-50/86 shadow-[0_28px_80px_rgba(15,23,42,0.22)] ring-1 ring-slate-950/5 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/84 dark:shadow-[0_28px_90px_rgba(0,0,0,0.55)] dark:ring-white/10"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(14,165,233,0.20),transparent_32%),radial-gradient(circle_at_92%_16%,rgba(245,158,11,0.16),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.72),rgba(255,255,255,0.18))] dark:bg-[radial-gradient(circle_at_12%_8%,rgba(34,211,238,0.14),transparent_32%),radial-gradient(circle_at_92%_16%,rgba(250,204,21,0.12),transparent_30%),linear-gradient(145deg,rgba(15,23,42,0.82),rgba(2,6,23,0.46))]" />
                <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80 dark:via-white/40" />

                <div className="relative p-3">
                  <motion.div
                    variants={rowVariants}
                    className="mb-2 flex items-center justify-between px-2 pt-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg shadow-slate-950/20 dark:bg-white dark:text-slate-950">
                        <Sparkles className="size-4" />
                      </span>
                      <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Command
                      </span>
                    </div>
                    <span className="rounded-full border border-slate-200/80 bg-white/70 px-2 py-1 text-[11px] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-400">
                      3 tools
                    </span>
                  </motion.div>

                  <div className="grid gap-2">
                    <motion.button
                      variants={rowVariants}
                      type="button"
                      onClick={openCollectDialog}
                      className={actionRowClass}
                    >
                      <span
                        className={`${iconFrameClass} border-sky-200/80 bg-sky-50 text-sky-700 shadow-sky-500/10 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200`}
                      >
                        <Plus className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-slate-950 dark:text-white">
                          Collect URL
                        </span>
                        <span className="mt-0.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                          Timeline intake
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-slate-400 transition duration-300 group-hover/action:translate-x-0.5 group-hover/action:text-slate-700 dark:group-hover/action:text-slate-200" />
                    </motion.button>

                    <motion.div variants={rowVariants}>
                      <Link
                        href="/clipboard"
                        onClick={() => setIsMenuOpen(false)}
                        className={actionRowClass}
                      >
                        <span
                          className={`${iconFrameClass} border-emerald-200/80 bg-emerald-50 text-emerald-700 shadow-emerald-500/10 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200`}
                        >
                          <ClipboardCheck className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black text-slate-950 dark:text-white">
                            Universal Paste
                          </span>
                          <span className="mt-0.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                            Cross-device clipboard
                          </span>
                        </span>
                        <ChevronRight className="size-4 text-slate-400 transition duration-300 group-hover/action:translate-x-0.5 group-hover/action:text-slate-700 dark:group-hover/action:text-slate-200" />
                      </Link>
                    </motion.div>

                    <motion.div variants={rowVariants}>
                      <Link
                        href="/admin/bark"
                        onClick={() => setIsMenuOpen(false)}
                        className={actionRowClass}
                      >
                        <span
                          className={`${iconFrameClass} border-amber-200/80 bg-amber-50 text-amber-700 shadow-amber-500/10 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200`}
                        >
                          <Bell className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black text-slate-950 dark:text-white">
                            Bark Console
                          </span>
                          <span className="mt-0.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                            Notification endpoints
                          </span>
                        </span>
                        <ChevronRight className="size-4 text-slate-400 transition duration-300 group-hover/action:translate-x-0.5 group-hover/action:text-slate-700 dark:group-hover/action:text-slate-200" />
                      </Link>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            aria-expanded={isMenuOpen}
            aria-controls="action-command-panel"
            aria-label={isMenuOpen ? 'Close action menu' : 'Open action menu'}
            title={isMenuOpen ? 'Close action menu' : 'Open action menu'}
            onClick={() => setIsMenuOpen((open) => !open)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="group relative flex h-16 min-w-16 items-center justify-center gap-3 overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 px-4 text-white shadow-[0_22px_60px_rgba(15,23,42,0.26)] outline-none transition duration-300 hover:shadow-[0_26px_70px_rgba(15,23,42,0.34)] focus-visible:ring-3 focus-visible:ring-slate-400/40 dark:border-white/12 dark:bg-white dark:text-slate-950 dark:shadow-[0_24px_70px_rgba(0,0,0,0.55)] sm:min-w-[11.5rem]"
          >
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_12%,rgba(125,211,252,0.38),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(251,191,36,0.28),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.16),transparent_46%)] opacity-85 transition duration-500 group-hover:opacity-100 dark:bg-[radial-gradient(circle_at_22%_12%,rgba(14,165,233,0.18),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(245,158,11,0.20),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.10),transparent_46%)]" />
            <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-slate-950/30" />

            <span className="relative flex size-10 items-center justify-center rounded-full bg-white text-slate-950 shadow-lg shadow-black/15 dark:bg-slate-950 dark:text-white dark:shadow-slate-950/15">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={isMenuOpen ? 'close' : 'open'}
                  initial={{ opacity: 0, rotate: -45, scale: 0.82 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 45, scale: 0.82 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                  className="flex"
                >
                  {isMenuOpen ? (
                    <X className="size-5" />
                  ) : (
                    <LayoutGrid className="size-5" />
                  )}
                </motion.span>
              </AnimatePresence>
            </span>

            <span className="relative hidden min-w-0 flex-col items-start sm:flex">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55 dark:text-slate-950/50">
                Cleon
              </span>
              <span className="text-sm font-black leading-5 tracking-normal text-white dark:text-slate-950">
                Actions
              </span>
            </span>
          </motion.button>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/50 bg-card/95 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:shadow-[0_30px_90px_rgba(0,0,0,0.55)] md:p-10">
          <DialogHeader className="space-y-4">
            <DialogTitle className="text-3xl font-black tracking-normal text-foreground">
              Collect Content
            </DialogTitle>
            <DialogDescription className="text-base leading-relaxed text-muted-foreground">
              Paste any URL below. Cleon will analyze the content and store a summarized version in your timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-8">
            <SubmitUrlForm
              onSubmit={handleUrlSubmit}
              isSubmitting={isSubmitting}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
