'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, User, Plus, Sparkles } from 'lucide-react';
import { SubmitUrlForm } from './SubmitUrlForm';
import { Button } from '@/components/ui/button';
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
  const [isOpen, setIsOpen] = useState(false);

  const handleUrlSubmit = async (url: string) => {
    const success = await onSubmit(url);
    if (success) {
      setIsOpen(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 flex flex-col items-end space-y-4 z-50">
      
      {/* Action Buttons Stack */}
      <div className="flex flex-col space-y-4 items-center">
        
        {/* Profile / Stats Placeholder */}
        <Button 
          variant="outline" 
          size="icon" 
          className="w-12 h-12 rounded-full bg-card/50 backdrop-blur-md border-border/50 shadow-lg text-muted-foreground hover:text-foreground hover:bg-card transition-all"
        >
          <User className="w-5 h-5" />
        </Button>
        
        {/* Settings / Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger 
            render={
              <Button
                variant="outline"
                size="icon"
                className="w-12 h-12 rounded-full bg-card/50 backdrop-blur-md border-border/50 shadow-lg text-muted-foreground hover:text-foreground hover:bg-card transition-all"
              />
            }
          >
            <Settings className="w-5 h-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[180px] border-border/50 backdrop-blur-xl bg-card/80">
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

        {/* The Main Pulse Button - Add URL */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger 
            render={
              <button className="outline-none" />
            }
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                size="icon"
                className="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all"
              >
                <Plus className="w-7 h-7" />
              </Button>
            </motion.div>
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
      </div>
    </div>
  );
}
