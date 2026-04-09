'use client';

import { useState } from 'react';
import { Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { Post } from './PostCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface Props {
  post: Post | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
}

export function PostDetailModal({ post, onClose, onDelete }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!post) return null;

  // Determine Title and Content
  let title = post.title || '';
  let body = post.contentText || '';

  if (!post.title) {
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
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setIsDeleting(true);
    await onDelete(post.id);
    setIsDeleting(false);
    onClose();
  };

  return (
    <Dialog open={!!post} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] md:w-full max-w-2xl max-h-[90vh] p-0 overflow-hidden rounded-3xl sm:rounded-3xl border-border/50 bg-card/95 backdrop-blur-2xl transition-all selection:bg-indigo-500/20 shadow-2xl">
        
        {/* Header Overlay */}
        <DialogHeader className="p-5 md:p-6 border-b border-border/40 bg-card/50 backdrop-blur-md flex flex-row items-center justify-between space-y-0 sticky top-0 z-10">
          <div className="flex items-center space-x-3 text-left">
            <Avatar className="w-10 h-10 border border-border/60 shadow-sm">
              <AvatarImage src={post.avatarUrl} alt={post.authorName} className="object-cover" />
              <AvatarFallback className="bg-indigo-500 text-white font-bold">{post.authorName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <DialogTitle className="text-[15px] font-black tracking-tight text-foreground leading-none mb-1.5 uppercase">
                {post.authorName}
              </DialogTitle>
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 leading-none uppercase tracking-widest font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-none w-fit">
                {post.platform}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <ScrollArea className="flex-1 overflow-y-auto max-h-[calc(90vh-140px)]">
           <div className="p-6 md:p-8 space-y-8 max-w-2xl mx-auto">
              {/* Content Section */}
              <div className="space-y-4">
                {title && (
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight leading-snug text-foreground">
                    {title}
                  </h2>
                )}
                {body && (
                  <div className="text-[15px] md:text-base leading-relaxed whitespace-pre-wrap font-medium text-foreground/80 tracking-normal">
                    {body}
                  </div>
                )}
              </div>

              {/* Full Media Grid */}
              {post.mediaUrls.length > 0 && (
                <div className="space-y-6">
                  {post.mediaUrls.map((url, i) => (
                    <div key={i} className="rounded-3xl overflow-hidden border border-border/40 bg-muted/30 group">
                      <img 
                        src={url.replace(/^http:\/\//i, 'https://')} 
                        referrerPolicy="no-referrer"
                        alt={`Media ${i}`} 
                        className="w-full h-auto object-contain max-h-[80vh] group-hover:scale-[1.01] transition-transform duration-700"
                      />
                    </div>
                  ))}
                </div>
              )}
           </div>
        </ScrollArea>

        {/* Footer Actions */}
        <DialogFooter className="p-6 border-t border-border/40 bg-muted/5 flex flex-col sm:flex-row sm:justify-between items-center gap-4">
          <Button
            variant="ghost"
            className="text-indigo-600 dark:text-indigo-400 font-bold tracking-tight hover:bg-indigo-500/10 transition-all group rounded-full px-6"
            render={
              <a href={post.originalUrl} target="_blank" rel="noopener noreferrer" />
            }
          >
            <ExternalLink className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
            VIEW ORIGINAL SOURCE
          </Button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant={confirmDelete ? "destructive" : "outline"}
              disabled={isDeleting}
              onClick={handleDelete}
              className={`flex-1 sm:flex-none rounded-full px-8 h-12 border-border/50 transition-all duration-300 font-bold tracking-tighter ${
                confirmDelete ? 'scale-105 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'hover:bg-destructive/5 hover:text-destructive hover:border-destructive/40'
              }`}
            >
              {isDeleting ? (
                 <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                 <Trash2 className="w-5 h-5 mr-2" />
              )}
              {isDeleting ? "PROCESSING..." : confirmDelete ? "REALLY DELETE?" : "DELETE POST"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
