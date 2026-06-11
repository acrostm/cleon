'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SendHorizontal, Link as LinkIcon, Loader2, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  onSubmit: (url: string) => void | Promise<boolean>;
  isSubmitting: boolean;
}

export function SubmitUrlForm({ onSubmit, isSubmitting }: Props) {
  const [url, setUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    const result = await onSubmit(url.trim());
    if (result !== false) setUrl('');
  };

  return (
    <motion.form 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onSubmit={handleSubmit} 
      className="grid w-full gap-3"
    >
      <div className="group relative overflow-hidden rounded-lg border border-white/10 bg-black/25 transition duration-300 focus-within:border-cyan-300/45 focus-within:bg-black/35 focus-within:shadow-[0_0_0_3px_rgba(34,211,238,0.12)]">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          <LinkIcon className="size-3.5 text-cyan-200" />
          URL Intake
        </div>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://x.com/...  bilibili.com/...  mp.weixin.qq.com/..."
          className="h-14 w-full bg-transparent px-3 text-sm font-medium text-white outline-none placeholder:text-slate-600"
          disabled={isSubmitting}
          required
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <ShieldCheck className="size-3.5 text-emerald-300" />
          SSRF guard active
        </span>
        <Button
          type="submit"
          disabled={!url.trim() || isSubmitting}
          className="h-10 rounded-md bg-cyan-300 px-4 font-black text-slate-950 transition hover:bg-cyan-200"
        >
          {isSubmitting ? (
             <Loader2 className="size-4 animate-spin" />
          ) : (
             <SendHorizontal className="size-4" />
          )}
          Capture
        </Button>
      </div>
    </motion.form>
  );
}
