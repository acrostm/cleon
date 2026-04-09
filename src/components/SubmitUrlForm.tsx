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
      className="relative flex items-center w-full shadow-2xl shadow-indigo-500/10 rounded-full bg-white dark:bg-slate-900 overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800 transition-all focus-within:ring-2 focus-within:ring-indigo-500"
    >
      <div className="pl-6 text-slate-400">
        <LinkIcon className="w-5 h-5" />
      </div>
      <Input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Drop a Twitter, Bilibili, or Web link here..."
        className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-[16px] md:text-lg h-16 w-full placeholder:text-slate-400"
        disabled={isSubmitting}
        required
      />
      <div className="pr-2">
        <Button 
          type="submit" 
          size="icon" 
          disabled={!url || isSubmitting}
          className="rounded-full w-12 h-12 bg-indigo-600 hover:bg-indigo-700 transition-colors dark:text-white"
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
