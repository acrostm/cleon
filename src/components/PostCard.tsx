import { useState } from 'react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPlatformLogo } from '@/lib/platforms';

export type Post = {
  id: string;
  originalUrl: string;
  platform: 'TWITTER' | 'BILIBILI' | 'WEB' | 'XIAOHONGSHU';
  authorName: string;
  avatarUrl: string;
  title?: string | null;
  contentText: string;
  mediaUrls: string[];
  createdAt: string;
};

export function PostCard({ post, onClick }: { post: Post; onClick?: () => void }) {
  const date = new Date(post.createdAt);
  const timeStr = format(date, 'HH:mm');
  const dateStr = format(date, 'MMM dd, yyyy');


  // Determine Title and Content
  const title = post.title || '';
  const body = post.contentText || '';

  // Grid layout helper
  const mediaCount = post.mediaUrls?.length || 0;
  let gridClass = "grid-cols-1";
  if (mediaCount === 2) gridClass = "grid-cols-2";
  else if (mediaCount >= 3) gridClass = "grid-cols-2 md:grid-cols-3";

  return (
    <div className="flex group relative">
      {/* Left Column: Detailed Timestamp */}
      <div className="hidden md:flex flex-col items-end w-24 pt-8 pr-8 opacity-40 group-hover:opacity-100 transition-opacity duration-300">
        <span className="text-xs font-bold leading-none text-foreground">{timeStr}</span>
        <span className="text-[9px] uppercase tracking-tighter mt-1.5 font-bold text-muted-foreground">{dateStr}</span>
      </div>

      {/* Center Column: The Rail Node */}
      <div className="relative flex flex-col items-center w-12 md:w-16 pt-9">
        <div className="z-10 w-3 h-3 rounded-full border-2 border-background bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] group-hover:scale-125 transition-transform duration-500" />
      </div>

      {/* Right Column: The Card Content */}
      <div className="flex-1 pb-8">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onClick}
        >
          <Card className="rounded-[2rem] overflow-hidden border-border/50 bg-card/40 backdrop-blur-xl hover:bg-card hover:border-indigo-500/30 transition-all duration-500 cursor-pointer shadow-sm hover:shadow-2xl hover:shadow-indigo-500/5 group/card">
            <CardHeader className="p-6 pb-3">
              {/* Mobile Date Header */}
              <div className="flex md:hidden items-center gap-2 mb-4 text-[10px] font-bold text-indigo-500/80 uppercase tracking-widest leading-none">
                 {dateStr} • {timeStr}
              </div>

              {/* Dynamic Title */}
              {title && (
                <h2 className="text-xl md:text-2xl font-bold tracking-tight leading-tight text-foreground group-hover/card:text-indigo-600 dark:group-hover/card:text-indigo-400 transition-colors duration-300">
                  {title}
                </h2>
              )}
            </CardHeader>

            <CardContent className="px-6 py-2 space-y-6">
              {/* Truncated Body Content */}
              {body && (
                <div className="relative group/body">
                    <div 
                       className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-[15px] line-clamp-4 group-hover/card:text-foreground/80 transition-colors duration-300"
                    >
                      {body}
                    </div>
                </div>
              )}

              {/* Responsive Media Grid */}
              {mediaCount > 0 && (
                <div className={`grid ${gridClass} gap-3 rounded-2xl overflow-hidden border border-border/40`}>
                  {post.mediaUrls.map((url, i) => (
                     <div key={i} className={`rounded-lg overflow-hidden bg-muted/30 ${mediaCount === 3 && i === 0 ? 'col-span-2 md:col-span-1' : ''}`}>
                        <img 
                          src={url.replace(/^http:\/\//i, 'https://')} 
                          referrerPolicy="no-referrer"
                          alt={`Media ${i}`} 
                          loading="lazy"
                          className={`w-full h-auto ${mediaCount === 1 ? 'max-h-[500px] object-contain' : 'min-h-[220px] aspect-square object-cover'} hover:scale-[1.03] transition-transform duration-700`} 
                        />
                     </div>
                  ))}
                </div>
              )}
            </CardContent>

            <CardFooter className="p-6 pt-4 flex items-center justify-between bg-muted/5 dark:bg-muted/10 border-t border-border/40">
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9 border border-border/60">
                  <AvatarImage src={post.avatarUrl} alt={post.authorName} className="object-cover" />
                  <AvatarFallback className="bg-indigo-500 text-white font-bold">
                    {post.authorName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-bold text-sm leading-none text-foreground">{post.authorName}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                 <img 
                   src={getPlatformLogo(post.platform, post.originalUrl)} 
                   alt={post.platform} 
                   className="w-5 h-5 md:w-6 md:h-6 transition-all duration-500 rounded-[4px]" 
                 />
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
