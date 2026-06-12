'use client';

import { memo } from 'react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { ExternalLink, ImageIcon, Share2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { getPlatformLogo } from '@/lib/platforms';
import { FormattedText } from './FormattedText';
import { toast } from 'sonner';
import { isVideoUrl, isEmbedUrl } from '@/lib/utils';
import { getPostPreview, getPostTitle, platformMeta, type Post } from '@/lib/post-types';
import { useHydrated } from '@/lib/use-hydrated';

export type { Post } from '@/lib/post-types';

export const PostCard = memo(function PostCard({ post, onClick }: { post: Post; onClick?: () => void }) {
  const isHydrated = useHydrated();
  const date = isHydrated ? new Date(post.createdAt) : null;
  const timeStr = date ? format(date, 'HH:mm') : '';
  const dateStr = date ? format(date, 'MMM dd') : '';
  const fullDateStr = date ? format(date, 'yyyy-MM-dd') : '';
  const title = getPostTitle(post);
  const body = getPostPreview(post, 220);
  const meta = platformMeta[post.platform];

  const mediaCount = post.mediaUrls?.length || 0;
  let gridClass = "grid-cols-1";
  if (mediaCount === 2) gridClass = "grid-cols-2";
  else if (mediaCount >= 3) gridClass = "grid-cols-2";

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/#${post.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied to clipboard');
    }).catch((error) => {
      console.error('[Share Clipboard Error]:', error);
      toast.error('Failed to copy link');
    });
  };

  const handleOpenSource = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(post.originalUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <article id={post.id} data-post-card className="group relative grid gap-3 md:grid-cols-[4.5rem_1fr]">
      <div className="hidden pt-4 text-right md:block">
        <p className="text-xs font-black text-slate-200">{timeStr}</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{dateStr}</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={onClick}
        className="min-w-0"
      >
        <Card className="relative cursor-pointer overflow-hidden rounded-lg border-white/10 bg-white/[0.065] py-0 text-slate-100 ring-1 ring-white/5 backdrop-blur-2xl transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.09] hover:shadow-[0_28px_90px_rgba(8,145,178,0.15)]">
          <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${meta.tone} opacity-70`} />
          <CardHeader className="gap-4 p-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-slate-300">
                    <span className={`size-1.5 rounded-full bg-gradient-to-r ${meta.tone}`} />
                    {meta.label}
                  </span>
                  <span className="md:hidden">{fullDateStr && timeStr ? `${fullDateStr} / ${timeStr}` : ''}</span>
                  {mediaCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <ImageIcon className="size-3" />
                      {mediaCount}
                    </span>
                  )}
                </div>
                <h2 className="line-clamp-2 text-xl font-black leading-tight tracking-normal text-white transition group-hover:text-cyan-100 md:text-2xl">
                  <FormattedText text={title} />
                </h2>
              </div>
              <img
                src={getPlatformLogo(post.platform, post.originalUrl)}
                alt={post.platform}
                className="mt-1 size-8 shrink-0 rounded-md border border-white/10 bg-white/10 p-1 shadow-lg"
              />
            </div>
          </CardHeader>

          <CardContent className="px-4 pb-4">
            {body && (
              <FormattedText
                text={body}
                className="line-clamp-5 block text-[15px] leading-7 text-slate-300 transition group-hover:text-slate-200"
              />
            )}
          </CardContent>

          {mediaCount > 0 && (
            <CardContent className="px-4 pb-4 pt-0">
              <div className={`grid ${gridClass} overflow-hidden rounded-lg border border-white/10 bg-black/20`}>
                {post.mediaUrls.slice(0, 4).map((url, i) => {
                  const isVideo = isVideoUrl(url);
                  const isEmbed = isEmbedUrl(url);
                  const secureUrl = url.replace(/^http:\/\//i, 'https://');

                  const lowerUrl = secureUrl.toLowerCase();
                  const isR2 = lowerUrl.includes('r2.dev') ||
                    (process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN && lowerUrl.includes(process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN.toLowerCase()));
                  const needsProxy = !isR2 && (
                    lowerUrl.includes('twimg.com') ||
                    lowerUrl.includes('sns-webpic') ||
                    lowerUrl.includes('xiaohongshu.com')
                  );
                  const displayUrl = needsProxy ? `/api/proxy?url=${encodeURIComponent(secureUrl)}&referer=${encodeURIComponent(post.originalUrl)}` : secureUrl;
                  const commonClass = `block w-full bg-black/40 ${mediaCount === 1 ? 'max-h-[420px] object-contain' : 'aspect-square object-cover'} transition duration-700 group-hover:scale-[1.025]`;

                  return (
                    <div key={i} className="relative overflow-hidden border-white/10 odd:border-r even:border-l [&:nth-child(n+3)]:border-t">
                      {isEmbed ? (
                        <iframe
                          src={displayUrl}
                          allowFullScreen={true}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          referrerPolicy="strict-origin-when-cross-origin"
                          className="block aspect-video w-full border-0 bg-black"
                        />
                      ) : isVideo ? (
                        <video src={displayUrl} autoPlay muted loop playsInline className={commonClass} />
                      ) : (
                        <img
                          src={displayUrl}
                          referrerPolicy={needsProxy ? "no-referrer" : "strict-origin-when-cross-origin"}
                          alt={`Media ${i + 1}`}
                          loading="lazy"
                          className={commonClass}
                        />
                      )}
                      {i === 3 && mediaCount > 4 && (
                        <div className="absolute inset-0 grid place-items-center bg-black/55 text-sm font-black text-white">
                          +{mediaCount - 4}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}

          <CardFooter className="flex items-center justify-between gap-3 rounded-none border-t border-white/10 bg-black/20 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-9 border border-white/15">
                <AvatarImage src={post.avatarUrl} alt={post.authorName} className="object-cover" />
                <AvatarFallback className="bg-cyan-400 text-slate-950 font-black">
                  {post.authorName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-none text-white">{post.authorName}</p>
                <p className="mt-1 text-[11px] font-medium text-slate-500">{fullDateStr}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleShare}
                className="grid size-9 place-items-center rounded-md border border-white/10 text-slate-400 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-cyan-300/30"
                title="Copy deep link"
              >
                <Share2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleOpenSource}
                className="grid size-9 place-items-center rounded-md border border-white/10 text-slate-400 transition hover:border-amber-300/40 hover:bg-amber-300/10 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-amber-300/30"
                title="Open source"
              >
                <ExternalLink className="size-4" />
              </button>
              <span className="ml-1 hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 sm:inline-flex">
                <Sparkles className="size-3" />
                Detail
              </span>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </article>
  );
});
