'use client';

import { useState } from 'react';
import { Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { Post } from './PostCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { getPlatformLogo } from '@/lib/platforms';
import { FormattedText } from './FormattedText';
import { isVideoUrl, isEmbedUrl } from '@/lib/utils';

interface Props {
  post: Post | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
}

export function PostDetailModal({ post, onClose, onDelete }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!post) return null;

  const title = post.title || '';
  const body = post.contentText || '';

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
      <DialogContent className="w-[95vw] md:w-full max-w-2xl max-h-[90vh] p-0 overflow-hidden rounded-3xl sm:rounded-3xl border-border/50 bg-card/95 backdrop-blur-2xl transition-all flex flex-col selection:bg-indigo-500/20 shadow-2xl">

        {/*
          Simple layout:
          - One scrollable div (flex-1 min-h-0 overflow-y-auto) — direct flex child
          - Glass header inside it as sticky top-0 — stays put while content scrolls under
          - Footer outside as shrink-0 — always at bottom
          No absolute positioning. No wrapper divs. No h-full.
        */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* Sticky Glassmorphism Header */}
          <div className="sticky top-0 z-30 p-5 md:p-6 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="w-10 h-10 border border-border/60 shadow-sm">
                <AvatarImage src={post.avatarUrl} alt={post.authorName} className="object-cover" />
                <AvatarFallback className="bg-indigo-500 text-white font-bold">{post.authorName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <DialogTitle className="text-[15px] font-black tracking-tight text-foreground leading-none uppercase">
                {post.authorName}
              </DialogTitle>
            </div>
            <img 
              src={getPlatformLogo(post.platform, post.originalUrl)} 
              alt={post.platform} 
              className="w-5 h-5 md:w-6 md:h-6 rounded-[4px]" 
            />
          </div>

          {/* Content */}
          <div className="px-6 py-6 md:px-8 md:py-8 space-y-8 max-w-2xl mx-auto">
            <div className="space-y-4">
              {title && (
                <h2 className="text-xl md:text-2xl font-bold tracking-tight leading-snug text-foreground">
                  <FormattedText text={title} />
                </h2>
              )}
              {body && (
                <FormattedText 
                  text={body}
                  className="text-[15px] md:text-base leading-relaxed font-medium text-foreground/80 tracking-normal block"
                />
              )}
            </div>

            {post.mediaUrls.length > 0 && (
              <div className="space-y-6">
                {post.mediaUrls.map((url, i) => {
                  const isVideo = isVideoUrl(url);
                  const isEmbed = isEmbedUrl(url);
                  const secureUrl = url.replace(/^http:\/\//i, 'https://');
                  const commonClass = "w-full h-auto object-contain max-h-[80vh] group-hover:scale-[1.01] transition-transform duration-700";

                  return (
                    <div key={i} className="rounded-3xl overflow-hidden border border-border/40 bg-muted/30 group">
                      {isEmbed ? (
                        <iframe
                          src={secureUrl}
                          allowFullScreen={true}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          className="w-full aspect-video border-0 bg-black"
                        />
                      ) : isVideo ? (
                        <video
                          src={secureUrl}
                          controls
                          autoPlay
                          muted
                          loop
                          playsInline
                          className={commonClass}
                        />
                      ) : (
                        <img
                          src={secureUrl}
                          referrerPolicy="no-referrer"
                          alt={`Media ${i}`}
                          className={commonClass}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="shrink-0 p-6 border-t border-border/40 bg-muted/5 flex flex-col sm:flex-row sm:justify-between items-center gap-4">
          <Button
            variant="ghost"
            className="text-indigo-600 dark:text-indigo-400 font-bold tracking-tight hover:bg-indigo-500/10 transition-all group rounded-full px-6"
            render={
              <a href={post.originalUrl} target="_blank" rel="noopener noreferrer" />
            }
          >
            <ExternalLink className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
            SOURCE
          </Button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant={confirmDelete ? "destructive" : "outline"}
              disabled={isDeleting}
              onClick={handleDelete}
              className={`flex-1 sm:flex-none rounded-full px-8 h-12 border-border/50 transition-all duration-300 font-bold tracking-tighter ${confirmDelete ? 'scale-105 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'hover:bg-destructive/5 hover:text-destructive hover:border-destructive/40'
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
