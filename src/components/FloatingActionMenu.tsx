'use client';

import Link from 'next/link';
import { useEffect, useState, type ComponentType, type CSSProperties } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import {
  Bell,
  ClipboardCheck,
  Link2,
  Plus,
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

type OrbitAction = {
  key: string;
  label: string;
  shortLabel: string;
  icon: ComponentType<{ className?: string }>;
  position: { x: number; y: number; rotate: number };
  href?: string;
  onSelect?: () => void;
};

const orbitActionVariants: Variants = {
  hidden: ({ position }: { position: OrbitAction['position'] }) => ({
    opacity: 0,
    x: -position.x,
    y: position.y,
    scale: 0.48,
    rotate: -112,
    filter: 'blur(8px)',
    transition: {
      duration: 0.16,
      ease: [0.4, 0, 1, 1],
    },
  }),
  visible: ({ position, index }: { position: OrbitAction['position']; index: number }) => ({
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    rotate: position.rotate,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 520,
      damping: 32,
      mass: 0.72,
      delay: index * 0.045,
    },
  }),
};

const actionButtonClass =
  'group pointer-events-auto relative flex size-14 touch-pan-y items-center justify-center overflow-visible rounded-full border border-slate-950/28 bg-white/[0.74] text-slate-950 shadow-[0_16px_40px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-12px_24px_rgba(15,23,42,0.08)] outline-none backdrop-blur-[5px] backdrop-saturate-150 transition duration-300 before:pointer-events-none before:absolute before:inset-[1px] before:rounded-full before:bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.76),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.34),rgba(255,255,255,0.10)_46%,rgba(15,23,42,0.09))] before:opacity-90 after:pointer-events-none after:absolute after:inset-[7px] after:rounded-full after:border after:border-slate-950/14 hover:-translate-y-0.5 hover:border-slate-950/36 hover:bg-white/[0.84] hover:text-slate-950 hover:shadow-[0_20px_50px_rgba(15,23,42,0.30),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-12px_24px_rgba(15,23,42,0.10)] focus-visible:ring-3 focus-visible:ring-slate-950/22 dark:border-white/20 dark:bg-white/[0.055] dark:text-white/92 dark:shadow-[0_14px_38px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-12px_26px_rgba(255,255,255,0.025)] dark:before:bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.22),transparent_31%),linear-gradient(145deg,rgba(255,255,255,0.09),rgba(255,255,255,0.018)_46%,rgba(255,255,255,0.045))] dark:after:border-white/12 dark:hover:border-white/50 dark:hover:bg-white/[0.085] dark:hover:text-white dark:focus-visible:ring-white/30 sm:size-[3.75rem]';

const MotionLink = motion.create(Link);

export function FloatingActionMenu({ onSubmit, isSubmitting }: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  const handleUrlSubmit = async (url: string) => {
    const success = await onSubmit(url);
    if (success) {
      setIsDialogOpen(false);
      setIsMenuOpen(false);
    }
    return success;
  };

  const openCollectDialog = () => {
    setIsMenuOpen(false);
    setHoveredAction(null);
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (!isMenuOpen) return;

    const closeOnScroll = () => {
      setIsMenuOpen(false);
      setHoveredAction(null);
    };

    window.addEventListener('scroll', closeOnScroll, { passive: true });
    return () => window.removeEventListener('scroll', closeOnScroll);
  }, [isMenuOpen]);

  const actions: OrbitAction[] = [
    {
      key: 'collect',
      label: 'Collect URL',
      shortLabel: '收集',
      icon: Link2,
      position: { x: -104, y: 14, rotate: 0 },
      onSelect: openCollectDialog,
    },
    {
      key: 'clipboard',
      label: 'Universal Paste',
      shortLabel: '剪贴板',
      icon: ClipboardCheck,
      position: { x: -82, y: 82, rotate: 0 },
      href: '/clipboard',
    },
    {
      key: 'bark',
      label: 'Bark Console',
      shortLabel: 'Bark',
      icon: Bell,
      position: { x: -14, y: 104, rotate: 0 },
      href: '/admin/bark',
    },
  ];

  return (
    <>
      {!isDialogOpen && (
        <div className="pointer-events-none fixed bottom-5 right-4 z-[100] size-16 [--fab-action-radius:1.75rem] sm:bottom-7 sm:right-7 sm:size-[4.5rem] sm:[--fab-action-radius:1.875rem]">
          <AnimatePresence>
            {isMenuOpen && (
              <>
                <motion.div
                  key="speed-dial-actions"
                  id="action-speed-dial-menu"
                  role="menu"
                  aria-label="Cleon quick actions"
                  className="absolute inset-0 z-20 overflow-visible"
                >
                  {actions.map((action, index) => {
                    const Icon = action.icon;
                    const showLabel = hoveredAction === action.key;
                    const button = (
                      <>
                        <Icon className="relative z-10 size-5 stroke-[2.35] text-slate-950 dark:text-white sm:size-6" />
                        <AnimatePresence>
                          {showLabel && (
                            <motion.span
                              initial={{ opacity: 0, y: 4, scale: 0.94 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 4, scale: 0.94 }}
                              transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
                              className="pointer-events-none absolute left-1/2 top-[-2.15rem] z-20 flex -translate-x-1/2 items-center rounded-full border border-white/28 bg-black/[0.18] px-2.5 py-1.5 text-center shadow-[0_10px_24px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-[3px] backdrop-saturate-150 dark:border-white/16 dark:bg-black/[0.20] sm:top-[-2.3rem] sm:px-3"
                            >
                              <span className="whitespace-nowrap text-xs font-black leading-none text-white">
                                {action.shortLabel}
                              </span>
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </>
                    );

                    const motionProps = {
                      custom: { position: action.position, index },
                      variants: orbitActionVariants,
                      initial: 'hidden',
                      animate: 'visible',
                      exit: 'hidden',
                    } as const;

                    const positionStyle = {
                      left: `calc(50% + ${action.position.x}px - var(--fab-action-radius))`,
                      top: `calc(50% - ${action.position.y}px - var(--fab-action-radius))`,
                    } satisfies CSSProperties;

                    const interactiveMotionProps = {
                      whileHover: { y: -2, scale: 1.035 },
                      whileTap: { scale: 0.95 },
                      transition: { type: 'spring', stiffness: 520, damping: 34 },
                    } as const;

                    const actionNode = action.href ? (
                      <MotionLink
                        href={action.href}
                        data-fab-action={action.key}
                        role="menuitem"
                        aria-label={action.label}
                        onPointerEnter={() => setHoveredAction(action.key)}
                        onPointerLeave={() => setHoveredAction(null)}
                        onMouseEnter={() => setHoveredAction(action.key)}
                        onMouseLeave={() => setHoveredAction(null)}
                        onFocus={() => setHoveredAction(action.key)}
                        onBlur={() => setHoveredAction(null)}
                        onClick={() => {
                          setIsMenuOpen(false);
                          setHoveredAction(null);
                        }}
                        className={actionButtonClass}
                        {...interactiveMotionProps}
                      >
                        {button}
                      </MotionLink>
                    ) : (
                      <motion.button
                        type="button"
                        data-fab-action={action.key}
                        role="menuitem"
                        aria-label={action.label}
                        onPointerEnter={() => setHoveredAction(action.key)}
                        onPointerLeave={() => setHoveredAction(null)}
                        onMouseEnter={() => setHoveredAction(action.key)}
                        onMouseLeave={() => setHoveredAction(null)}
                        onFocus={() => setHoveredAction(action.key)}
                        onBlur={() => setHoveredAction(null)}
                        onClick={action.onSelect}
                        className={actionButtonClass}
                        {...interactiveMotionProps}
                      >
                        {button}
                      </motion.button>
                    );

                    return (
                      <motion.div
                        key={action.key}
                        className="absolute"
                        style={positionStyle}
                        {...motionProps}
                      >
                        {actionNode}
                      </motion.div>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            data-fab-trigger="true"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-controls="action-speed-dial-menu"
            aria-label={isMenuOpen ? 'Close action menu' : 'Open action menu'}
            onClick={() => {
              setIsMenuOpen((open) => !open);
              setHoveredAction(null);
            }}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            className="group pointer-events-auto absolute inset-0 z-30 flex touch-pan-y items-center justify-center overflow-hidden rounded-full border border-slate-950/30 bg-white/[0.78] text-slate-950 shadow-[0_18px_50px_rgba(15,23,42,0.26),inset_0_1px_0_rgba(255,255,255,0.94),inset_0_-16px_34px_rgba(15,23,42,0.09)] outline-none backdrop-blur-[5px] backdrop-saturate-150 transition duration-300 hover:border-slate-950/40 hover:bg-white/[0.88] hover:text-slate-950 hover:shadow-[0_24px_66px_rgba(15,23,42,0.32),inset_0_1px_0_rgba(255,255,255,0.96),inset_0_-16px_34px_rgba(15,23,42,0.11)] focus-visible:ring-3 focus-visible:ring-slate-950/22 dark:border-white/20 dark:bg-white/[0.06] dark:text-white/95 dark:shadow-[0_18px_48px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.34),inset_0_-16px_34px_rgba(255,255,255,0.035)] dark:hover:bg-white/[0.11] dark:hover:text-white dark:hover:shadow-[0_24px_62px_rgba(0,0,0,0.46),inset_0_1px_0_rgba(255,255,255,0.44),inset_0_-16px_34px_rgba(255,255,255,0.055)] dark:focus-visible:ring-white/30"
          >
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.78),transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.36),rgba(255,255,255,0.12)_46%,rgba(15,23,42,0.09))] opacity-95 transition duration-500 group-hover:opacity-100 dark:bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.28),transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.10),rgba(255,255,255,0.02)_46%,rgba(255,255,255,0.06))] dark:opacity-80" />
            <span className="absolute inset-[5px] rounded-full border border-slate-950/14 dark:border-white/12" />
            <motion.span
              animate={{ rotate: isMenuOpen ? 45 : 0, scale: isMenuOpen ? 0.94 : 1 }}
              transition={{ type: 'spring', stiffness: 620, damping: 34 }}
              className="relative flex"
            >
              <Plus className="size-8 stroke-[2.45] text-slate-950 dark:text-white" />
            </motion.span>
            <span className="sr-only">Cleon actions</span>
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
