'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

export type Post = {
  id: string;
  originalUrl: string;
  platform: 'TWITTER' | 'BILIBILI' | 'WEB' | 'XIAOHONGSHU';
  authorName: string;
  avatarUrl: string;
  contentText: string;
  mediaUrls: string[];
  createdAt: string;
};

export function PostCard({ post }: { post: Post }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

  const getPlatformLogo = () => {
    let domain = 'example.com';
    switch (post.platform) {
        case 'TWITTER': domain = 'x.com'; break;
        case 'BILIBILI': domain = 'bilibili.com'; break;
        case 'XIAOHONGSHU': domain = 'xiaohongshu.com'; break;
        case 'WEB': 
            try { domain = new URL(post.originalUrl).hostname; } catch(e) {}
            break;
    }
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  };

  // Determine Title and Content
  let title = '';
  let body = '';
  const textSegments = post.contentText.trim().split(/\n+/);
  if (textSegments.length > 1) {
      title = textSegments[0];
      body = textSegments.slice(1).join('\n');
  } else {
      const sentences = post.contentText.split(/(?<=[。！？.!?])/);
      if (sentences.length > 1 && sentences[0].length < 100) {
          title = sentences[0];
          body = sentences.slice(1).join('').trim();
      } else {
          title = post.contentText;
          body = '';
      }
  }

  // Grid layout helper
  const mediaCount = post.mediaUrls?.length || 0;
  let gridClass = "grid-cols-1";
  if (mediaCount === 2) gridClass = "grid-cols-2";
  else if (mediaCount >= 3) gridClass = "grid-cols-2 md:grid-cols-3";

  return (
    <motion.article 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 md:p-7 rounded-[2.5rem] bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/50 shadow-xl shadow-indigo-500/5 dark:shadow-none hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300"
    >
      
      {/* Dynamic Title (First Sentence) */}
      {title && (
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-4 leading-snug">
          {title}
        </h2>
      )}

      {/* Truncated Body Content */}
      {body && (
        <div className="relative mb-5 group">
           <div 
              className={`text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap text-[15px] transition-all duration-300 ${isExpanded ? '' : 'line-clamp-4'}`}
           >
             {body}
           </div>
           
           {!isExpanded && body.length > 150 && (
               <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-white/90 dark:from-[#0d1629]/90 to-transparent pointer-events-none" />
           )}

           {body.length > 150 && (
             <button 
               onClick={() => setIsExpanded(!isExpanded)}
               className="mt-2 text-[13px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline flex items-center gap-1.5 transition-colors"
             >
               {isExpanded ? (
                 <>Collapse Selection <ChevronUp className="w-3.5 h-3.5" /></>
               ) : (
                 <>Read Full Text <ChevronDown className="w-3.5 h-3.5" /></>
               )}
             </button>
           )}
        </div>
      )}

      {/* Responsive Media Grid */}
      {mediaCount > 0 && (
        <div className={`mt-4 mb-6 grid ${gridClass} gap-2.5 rounded-[1.5rem] overflow-hidden`}>
          {post.mediaUrls.map((url, i) => (
             <div key={i} className={`rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950/50 border border-slate-100/50 dark:border-slate-800/50 ${mediaCount === 3 && i === 0 ? 'col-span-2 md:col-span-1' : ''}`}>
                <img 
                  src={url.replace(/^http:\/\//i, 'https://')} 
                  referrerPolicy="no-referrer"
                  alt={`Media ${i}`} 
                  loading="lazy"
                  className={`w-full h-auto ${mediaCount === 1 ? 'max-h-[500px] object-contain' : 'min-h-[220px] aspect-square object-cover'} hover:scale-[1.03] transition-transform duration-700 cursor-zoom-in`} 
                />
             </div>
          ))}
        </div>
      )}

      {/* Suppressed Metadata Footer */}
      <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/50 flex justify-between items-center opacity-75 hover:opacity-100 transition-opacity duration-300">
        <div className="flex items-center space-x-3 w-full">
          <Avatar className="w-8 h-8 md:w-9 md:h-9 border border-slate-200 dark:border-slate-800 rounded-full shadow-sm">
            <AvatarImage src={post.avatarUrl} alt={post.authorName} className="object-cover" />
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-[10px] font-bold">
              {post.authorName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-0.5">
              <span className="font-medium text-[13px] md:text-sm text-slate-800 dark:text-slate-200 truncate">{post.authorName}</span>
            </div>
            <div className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
              <span>{timeAgo}</span>
              <span>•</span>
              <a href={post.originalUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 dark:hover:text-indigo-400 hover:underline transition-colors flex items-center gap-1">
                View Original
              </a>
            </div>
          </div>
          
          {/* Distinct Colored Visual Platform Logo */}
          <div className="shrink-0 ml-auto flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-50/50 dark:bg-slate-800/50 shadow-sm border border-slate-200/80 dark:border-slate-700/80">
             <img 
               src={getPlatformLogo()} 
               alt={post.platform} 
               className="w-4 h-4 md:w-4.5 md:h-4.5 rounded-sm object-contain opacity-[0.85] hover:opacity-100 transition-opacity drop-shadow-sm" 
             />
          </div>
        </div>
      </div>

    </motion.article>
  );
}
