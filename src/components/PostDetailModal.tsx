'use client';

import { useState } from 'react';
import { Clock, ExternalLink, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
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
import { getPostTitle, platformMeta } from '@/lib/post-types';
import { format } from 'date-fns';

interface Props {
  post: Post | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<boolean>;
}

export function PostDetailModal({ post, onClose, onDelete }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!post) return null;

  const title = getPostTitle(post);
  const body = post.contentText || '';
  const meta = platformMeta[post.platform];
  const createdAt = format(new Date(post.createdAt), 'yyyy-MM-dd HH:mm');

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setIsDeleting(true);
    const success = await onDelete(post.id);
    setIsDeleting(false);
    if (success) {
      onClose();
    }
  };

  return (
    <Dialog open={!!post} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton className="max-h-[92vh] w-[96vw] max-w-3xl overflow-hidden rounded-lg border-white/10 bg-[#0b0f17]/96 p-0 text-slate-100 shadow-[0_40px_140px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:rounded-lg">
        <div className="flex max-h-[92vh] min-h-0 flex-col">
          <div className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/10 bg-[#0b0f17]/88 p-4 pr-12 backdrop-blur-xl md:p-5 md:pr-14">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-10 border border-white/15 shadow-lg">
                <AvatarImage src={post.avatarUrl} alt={post.authorName} className="object-cover" />
                <AvatarFallback className="bg-cyan-300 text-slate-950 font-black">{post.authorName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <DialogTitle className="truncate text-sm font-black leading-none text-white">{post.authorName}</DialogTitle>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  <span className={`size-1.5 rounded-full bg-gradient-to-r ${meta.tone}`} />
                  {meta.label}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                nativeButton={false}
                className="hidden h-9 rounded-md px-3 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/10 sm:inline-flex"
                render={
                  <a href={post.originalUrl} target="_blank" rel="noopener noreferrer" />
                }
              >
                <ExternalLink className="mr-2 size-4" />
                Source
              </Button>
              <img
                src={getPlatformLogo(post.platform, post.originalUrl)}
                alt={post.platform}
                className="size-8 rounded-md border border-white/10 bg-white/10 p-1"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <article className="mx-auto grid max-w-3xl gap-7 px-5 py-6 md:px-8 md:py-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs font-bold text-slate-400">
                <Clock className="size-3.5" />
                {createdAt}
              </div>
              <h2 className="text-2xl font-black leading-tight tracking-normal text-white md:text-3xl">
                <FormattedText text={title} />
              </h2>
              {body && (
                <FormattedText
                  text={body}
                  className="block text-[15px] leading-8 text-slate-200 md:text-base"
                />
              )}
            </div>

            {post.mediaUrls.length > 0 && (
              <div className="space-y-4">
                {post.mediaUrls.map((url, i) => {
                  const isVideo = isVideoUrl(url);
                  const isEmbed = isEmbedUrl(url);
                  const secureUrl = url.replace(/^http:\/\//i, 'https://');
                  const commonClass = "h-auto max-h-[78vh] w-full object-contain transition duration-700 group-hover:scale-[1.01]";

                  return (
                    <div key={i} className="group overflow-hidden rounded-lg border border-white/10 bg-black/35">
                      {isEmbed ? (
                        <iframe
                          src={secureUrl}
                          allowFullScreen={true}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          referrerPolicy="strict-origin-when-cross-origin"
                          className="aspect-video w-full border-0 bg-black"
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
            </article>
          </div>

          <DialogFooter className="shrink-0 gap-3 border-t border-white/10 bg-[#0b0f17]/88 p-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between md:px-5">
            <Button
              variant="ghost"
              nativeButton={false}
              className="h-9 rounded-md px-3 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/10 sm:hidden"
              render={
                <a href={post.originalUrl} target="_blank" rel="noopener noreferrer" />
              }
            >
              <ExternalLink className="mr-2 size-4" />
              Source
            </Button>
            <p className="hidden min-w-0 flex-1 truncate text-xs text-slate-500 sm:block">
              {confirmDelete ? 'Click confirm to permanently remove this capture.' : post.originalUrl}
            </p>
            <Button
              variant={confirmDelete ? "destructive" : "outline"}
              disabled={isDeleting}
              onClick={handleDelete}
              className={`h-9 rounded-md border-white/10 px-3 text-xs font-black transition duration-300 ${confirmDelete ? 'bg-rose-500/20 text-rose-100 ring-3 ring-rose-400/20' : 'bg-white/[0.04] text-slate-300 hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-100'
              }`}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                confirmDelete ? <ShieldAlert className="mr-2 size-4" /> : <Trash2 className="mr-2 size-4" />
              )}
              {isDeleting ? "Deleting..." : confirmDelete ? "Confirm" : "Delete"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
