'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { Post } from './PostCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface Props {
  post: Post | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
}

export function PostDetailModal({ post, onClose, onDelete }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // If no post is selected, the outer AnimatePresence will handle the exit
  if (!post) return null;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      // Auto-reset confirmation after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setIsDeleting(true);
    await onDelete(post.id);
    setIsDeleting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
      {/* Background Dim & Blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl"
      />
      
      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
           <div className="flex items-center space-x-3">
              <Avatar className="w-10 h-10 border border-slate-200 dark:border-slate-800">
                <AvatarImage src={post.avatarUrl} alt={post.authorName} className="object-cover" />
                <AvatarFallback className="bg-indigo-500 text-white font-bold">{post.authorName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white leading-none mb-1">{post.authorName}</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                    {post.platform}
                  </span>
                </div>
              </div>
           </div>
           
           <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
           >
             <X className="w-5 h-5" />
           </Button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 custom-scrollbar">
           <div className="space-y-8 max-w-3xl mx-auto">
             {/* Full Content Text */}
             <div className="text-slate-800 dark:text-slate-100 text-lg md:text-xl leading-relaxed whitespace-pre-wrap font-medium selection:bg-indigo-100 dark:selection:bg-indigo-500/30">
               {post.contentText}
             </div>

             {/* Full Media Grid */}
             {post.mediaUrls.length > 0 && (
                <div className="space-y-4">
                  {post.mediaUrls.map((url, i) => (
                    <div key={i} className="rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                      <img 
                        src={url.replace(/^http:\/\//i, 'https://')} 
                        referrerPolicy="no-referrer"
                        alt={`Media ${i}`} 
                        className="w-full h-auto object-contain max-h-[80vh]"
                      />
                    </div>
                  ))}
                </div>
             )}
           </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
           <div className="flex items-center space-x-6">
             <a 
               href={post.originalUrl} 
               target="_blank" 
               rel="noopener noreferrer"
               className="flex items-center space-x-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors group"
             >
               <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
               <span className="hidden sm:inline">Open Original Source</span>
               <span className="sm:hidden">Original</span>
             </a>
           </div>

           <Button
             variant={confirmDelete ? "destructive" : "outline"}
             disabled={isDeleting}
             onClick={handleDelete}
             className={`rounded-full px-6 flex items-center space-x-2 transition-all duration-300 ${
               confirmDelete ? 'scale-105 shadow-lg shadow-red-500/20' : ''
             }`}
           >
             {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
             ) : (
                <Trash2 className="w-4 h-4" />
             )}
             <span className="font-semibold">
               {isDeleting ? "Deleting..." : confirmDelete ? "Confirm Delete?" : "Delete Post"}
             </span>
           </Button>
        </div>
      </motion.div>
    </div>
  );
}
