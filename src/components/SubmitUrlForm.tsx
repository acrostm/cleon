'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SendHorizontal, Link as LinkIcon, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  onSubmit: (url: string) => void;
  isSubmitting: boolean;
}

export function SubmitUrlForm({ onSubmit, isSubmitting }: Props) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit(url.trim());
    setUrl('');
  };

  return (
    <motion.form 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onSubmit={handleSubmit} 
      className="relative flex items-center w-full shadow-2xl shadow-indigo-500/5 rounded-full bg-card/40 backdrop-blur-xl overflow-hidden border border-border/50 transition-all duration-300 focus-within:border-indigo-500 focus-within:shadow-[0_0_25px_rgba(79,70,229,0.15)] group"
    >
      <div className="pl-6 text-muted-foreground/60 group-focus-within:text-indigo-500 transition-colors">
        <LinkIcon className="w-5 h-5" />
      </div>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Drop a Twitter, Bilibili, or Web link here..."
        className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-[15px] md:text-base h-16 px-4 text-foreground placeholder:text-muted-foreground/30 font-medium tracking-tight"
        disabled={isSubmitting}
        required
      />
      <div className="pr-2">
        <Button 
          type="submit" 
          size="icon" 
          disabled={!url || isSubmitting}
          className="rounded-full w-11 h-11 bg-indigo-600 hover:bg-indigo-700 transition-all dark:text-white shadow-lg active:scale-95 flex items-center justify-center"
        >
          {isSubmitting ? (
             <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
             <SendHorizontal className="w-4.5 h-4.5" />
          )}
        </Button>
      </div>
    </motion.form>
  );
}
