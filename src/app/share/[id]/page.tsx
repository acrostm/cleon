import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Clock, ExternalLink, RadioTower } from 'lucide-react';
import { format } from 'date-fns';

import { CommandCenterBackground } from '@/components/command-center/CommandCenterBackground';
import { FormattedText } from '@/components/FormattedText';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getPostTitle, platformMeta, type Platform } from '@/lib/post-types';
import { isEmbedUrl, isVideoUrl } from '@/lib/utils';
import { isValidPostShareToken } from '@/lib/post-share';
import prisma from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'Shared capture | Cleon',
  description: 'A read-only Cleon capture shared by signed link.',
  robots: {
    index: false,
    follow: false,
  },
};

type SharePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

function getToken(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPlatformMeta(platform: string) {
  if (platform in platformMeta) {
    return platformMeta[platform as Platform];
  }

  return { label: platform, tone: 'from-slate-300 to-cyan-300' };
}

export default async function SharedPostPage({ params, searchParams }: SharePageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const token = getToken(query.token);

  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (!post || !isValidPostShareToken(post, token)) {
    notFound();
  }

  const meta = getPlatformMeta(post.platform);
  const title = getPostTitle({
    ...post,
    platform: post.platform as Platform,
    createdAt: post.createdAt.toISOString(),
    shareUrl: '',
  });
  const createdAt = format(post.createdAt, 'yyyy-MM-dd HH:mm');

  return (
    <main className="min-h-screen overflow-x-hidden text-slate-100 selection:bg-cyan-300/20">
      <CommandCenterBackground />
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 md:px-8 md:py-10">
        <header className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.055] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-cyan-300/12 text-cyan-100">
              <RadioTower className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200/80">Cleon Share</p>
              <h1 className="truncate text-xl font-black text-white md:text-2xl">Read-only capture</h1>
            </div>
          </div>
          <span className="hidden rounded-md border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-bold text-slate-400 sm:inline-flex">
            Signed link
          </span>
        </header>

        <article className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.065] shadow-[0_32px_120px_rgba(8,145,178,0.14)] backdrop-blur-2xl">
          <div className={`h-px bg-gradient-to-r ${meta.tone}`} />
          <div className="flex flex-col gap-5 border-b border-white/10 bg-black/20 p-4 md:flex-row md:items-center md:justify-between md:p-6">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-12 border border-white/15 shadow-lg">
                <AvatarImage src={post.avatarUrl} alt={post.authorName} className="object-cover" />
                <AvatarFallback className="bg-cyan-300 font-black text-slate-950">
                  {post.authorName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-base font-black text-white">{post.authorName}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  <span className={`size-1.5 rounded-full bg-gradient-to-r ${meta.tone}`} />
                  {meta.label}
                  <span className="inline-flex items-center gap-1 normal-case tracking-normal text-slate-500">
                    <Clock className="size-3.5" />
                    {createdAt}
                  </span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              nativeButton={false}
              className="h-10 rounded-md border-white/10 bg-white/[0.05] px-4 font-bold text-slate-200 hover:bg-white/[0.1]"
              render={
                <a href={post.originalUrl} target="_blank" rel="noopener noreferrer" />
              }
            >
              <ExternalLink className="size-4" />
              Source
            </Button>
          </div>

          <div className="grid gap-7 p-5 md:p-8">
            <section className="space-y-4">
              <h2 className="text-2xl font-black leading-tight tracking-normal text-white md:text-4xl">
                <FormattedText text={title} />
              </h2>
              {post.contentText && (
                <FormattedText
                  text={post.contentText}
                  className="block text-[15px] leading-8 text-slate-200 md:text-base"
                />
              )}
            </section>

            {post.mediaUrls.length > 0 && (
              <section className="space-y-4">
                {post.mediaUrls.map((url, index) => {
                  const secureUrl = url.replace(/^http:\/\//i, 'https://');
                  const mediaClass = 'h-auto max-h-[78vh] w-full object-contain';

                  return (
                    <div key={`${url}-${index}`} className="overflow-hidden rounded-lg border border-white/10 bg-black/35">
                      {isEmbedUrl(url) ? (
                        <iframe
                          src={secureUrl}
                          allowFullScreen={true}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          referrerPolicy="strict-origin-when-cross-origin"
                          className="aspect-video w-full border-0 bg-black"
                          title={`Shared media ${index + 1}`}
                        />
                      ) : isVideoUrl(url) ? (
                        <video src={secureUrl} controls playsInline className={mediaClass} />
                      ) : (
                        <img
                          src={secureUrl}
                          referrerPolicy="no-referrer"
                          alt={`Shared media ${index + 1}`}
                          className={mediaClass}
                        />
                      )}
                    </div>
                  );
                })}
              </section>
            )}
          </div>
        </article>
      </div>
    </main>
  );
}
