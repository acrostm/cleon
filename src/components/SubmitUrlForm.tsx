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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      onSubmit={handleSubmit} 
      className="relative flex items-center w-full shadow-2xl shadow-indigo-500/5 rounded-full bg-card/80 backdrop-blur-md overflow-hidden border border-border transition-all focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10"
    >
      <div className="pl-6 text-muted-foreground/60">
        <LinkIcon className="w-5 h-5" />
      </div>
      <Input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Drop a Twitter, Bilibili, or Web link here..."
        className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-[16px] md:text-lg h-16 w-full placeholder:text-muted-foreground/40 font-medium"
        disabled={isSubmitting}
        required
      />
      <div className="pr-2">
        <Button 
          type="submit" 
          size="icon" 
          disabled={!url || isSubmitting}
          className="rounded-full w-12 h-12 bg-indigo-600 hover:bg-indigo-700 transition-all dark:text-white shadow-lg active:scale-95"
        >
          {isSubmitting ? (
             <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
             <SendHorizontal className="w-5 h-5" />
          )}
        </Button>
      </div>
    </motion.form>
  );
}
