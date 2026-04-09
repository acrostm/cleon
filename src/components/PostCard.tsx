'use client';

import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';

export type Post = {
  id: string;
  originalUrl: string;
  platform: 'TWITTER' | 'BILIBILI' | 'WEB';
  authorName: string;
  avatarUrl: string;
  contentText: string;
  mediaUrls: string[];
  createdAt: string;
};

export function PostCard({ post }: { post: Post }) {
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

  const getPlatformIcon = () => {
    switch (post.platform) {
        case 'TWITTER': return '𝕏 X / Twitter';
        case 'BILIBILI': return '📺 Bilibili';
        default: return '🌐 Web';
    }
  };

  return (
    <motion.article 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 md:p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-3">
          <Avatar className="w-12 h-12 border border-slate-100 dark:border-slate-800 rounded-full">
            <AvatarImage src={post.avatarUrl} alt={post.authorName} className="object-cover" />
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-semibold">
              {post.authorName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>{post.authorName}</span>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full text-slate-600 dark:text-slate-300 whitespace-nowrap">
                {getPlatformIcon()}
              </span>
            </h3>
            <div className="text-[13px] text-slate-500 mt-0.5">
              {timeAgo} • <a href={post.originalUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 hover:underline">Source</a>
            </div>
          </div>
        </div>
      </div>

      <div className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap text-[15px] mb-4 line-clamp-[10]">
        {post.contentText}
      </div>

      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className="mt-4 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <img 
            src={post.mediaUrls[0]} 
            alt="Media content" 
            className="w-full h-auto max-h-[500px] object-contain hover:scale-[1.02] transition-transform duration-500 cursor-pointer" 
          />
        </div>
      )}
    </motion.article>
  );
}
