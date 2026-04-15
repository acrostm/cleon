'use client';

import { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Settings, User, Plus, X, Sparkles, LayoutGrid } from 'lucide-react';
import { SubmitUrlForm } from './SubmitUrlForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  onSubmit: (url: string) => Promise<boolean>;
  isSubmitting: boolean;
}

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

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  // Animation variants for the radial items
  const itemVariants: Variants = {
    hidden: { opacity: 0, scale: 0, x: 0, y: 0 },
    visible: (index: number) => {
      const angle = (index * 45) + 180; // Start from 180 degrees (left) to 270 (top)
      const radius = 90;
      const x = Math.cos((angle * Math.PI) / 180) * radius;
      const y = Math.sin((angle * Math.PI) / 180) * radius;
      return {
        opacity: 1,
        scale: 1,
        x,
        y,
        transition: {
          type: "spring" as const,
          stiffness: 300,
          damping: 20,
          delay: index * 0.05
        }
      };
    }
  };

  const liquidGlassClass = `
    relative flex items-center justify-center rounded-full 
    bg-white/10 dark:bg-black/20 backdrop-blur-2xl 
    border border-white/30 dark:border-white/10
    shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]
    hover:shadow-[0_8px_32px_0_rgba(99,102,241,0.5)]
    transition-all duration-500 overflow-hidden
  `;

  return (
    <div className="fixed bottom-8 right-8 z-[60]">
      
      {/* Radial Menu Items */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* 1. Add URL (Plus) */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger 
                render={
                  <motion.button
                    custom={2}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    className={`${liquidGlassClass} w-12 h-12 absolute inset-0`}
                    title="Collect Content"
                  />
                }
              >
                <Plus className="w-5 h-5 text-foreground/80" />
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl rounded-[2.5rem] p-8 md:p-10 border-border/50 bg-card/95 backdrop-blur-2xl">
                <DialogHeader className="space-y-4">
                  <DialogTitle className="text-3xl font-black tracking-tighter text-foreground">
                    COLLECT CONTENT
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-base leading-relaxed">
                    Paste any URL below. We will analyze the content and store a summarized version in your timeline.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-8">
                  <SubmitUrlForm onSubmit={handleUrlSubmit} isSubmitting={isSubmitting} />
                </div>
              </DialogContent>
            </Dialog>

            {/* 2. Settings (Wheel) */}
            <DropdownMenu>
              <DropdownMenuTrigger 
                render={
                  <motion.button
                    custom={1}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    className={`${liquidGlassClass} w-12 h-12 absolute inset-0`}
                    title="Settings"
                  />
                }
              >
                <Settings className="w-5 h-5 text-foreground/80" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[180px] border-border/50 backdrop-blur-xl bg-card/80 mb-4">
                <DropdownMenuItem className="rounded-xl py-3 cursor-pointer focus:bg-indigo-500/10">
                  <Sparkles className="w-4 h-4 mr-2 text-indigo-500" />
                  <span className="font-semibold">AI Insights</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl py-3 cursor-pointer focus:bg-indigo-500/10 opacity-50">
                  <User className="w-4 h-4 mr-2" />
                  <span className="font-semibold">Profile Settings</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 3. User Profile */}
            <motion.button
              custom={0}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className={`${liquidGlassClass} w-12 h-12 absolute inset-0`}
              title="Profile"
            >
              <User className="w-5 h-5 text-foreground/80" />
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* Main Trigger Button */}
      <motion.button
        onClick={toggleMenu}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`${liquidGlassClass} w-16 h-16 z-50 shadow-[0_8px_32px_0_rgba(99,102,241,0.3)] hover:shadow-[0_8px_48px_0_rgba(99,102,241,0.5)] border-indigo-500/30`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isMenuOpen ? 'close' : 'open'}
            initial={{ opacity: 0, rotate: -90 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 90 }}
            transition={{ duration: 0.2 }}
          >
            {isMenuOpen ? (
              <X className="w-8 h-8 text-indigo-500" />
            ) : (
              <LayoutGrid className="w-8 h-8 text-indigo-500" />
            )}
          </motion.div>
        </AnimatePresence>
        
        {/* Constant subtle liquid background for the main button */}
        <div className="absolute inset-0 z-[-1] opacity-20">
          <div className="absolute inset-[-100%] bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.4),transparent_50%)] animate-[pulse_4s_ease-in-out_infinite] blur-xl" />
        </div>
      </motion.button>
    </div>
  );
}
