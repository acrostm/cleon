'use client';

import { memo } from 'react';
import { PostCard, Post } from './PostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { InfiniteScroll } from './InfiniteScroll';
import { GsapReveal } from '@/components/command-center/GsapReveal';
import { CommandCenterSurface } from '@/components/command-center/CommandCenterSurface';
import { Inbox, Radar, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  posts: Post[];
  isLoading: boolean;
  isSubmitting: boolean;
  onPostClick: (post: Post) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  canLoadMoreWhenEmpty?: boolean;
}

export const Timeline = memo(function Timeline({ 
  posts, 
  isLoading, 
  isSubmitting, 
  onPostClick,
  onLoadMore,
  hasMore,
  isLoadingMore,
  canLoadMoreWhenEmpty = false,
}: Props) {
  return (
    <div className="relative pb-10">
      <GsapReveal className="space-y-5" selector="[data-post-card]" y={24} stagger={0.045}>
        {isSubmitting && (
          <CommandCenterSurface className="grid gap-4 rounded-lg p-4">
            <div className="flex items-center gap-3 text-sm font-bold text-cyan-100">
              <span className="grid size-9 place-items-center rounded-md bg-cyan-300/15 text-cyan-100">
                <Radar className="size-4 animate-pulse" />
              </span>
              Analyzing capture and syncing media
            </div>
            <Skeleton className="h-4 w-2/3 bg-white/10" />
            <Skeleton className="h-28 w-full rounded-lg bg-white/10" />
          </CommandCenterSurface>
        )}

        {isLoading ? (
          <div className="space-y-5">
            {[1, 2, 3].map((i) => (
              <CommandCenterSurface key={i} className="grid gap-4 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-md bg-white/10" />
                  <div className="grid flex-1 gap-2">
                    <Skeleton className="h-4 w-2/3 bg-white/10" />
                    <Skeleton className="h-3 w-1/3 bg-white/10" />
                  </div>
                </div>
                <Skeleton className="h-32 w-full rounded-lg bg-white/10" />
              </CommandCenterSurface>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <CommandCenterSurface className="grid place-items-center rounded-lg px-6 py-16 text-center">
            <div className="grid max-w-sm gap-3">
              <span className="mx-auto grid size-12 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-slate-300">
                <Inbox className="size-5" />
              </span>
              <h3 className="text-xl font-black text-white">
                {canLoadMoreWhenEmpty ? 'No loaded captures for this filter' : 'No captures in this view'}
              </h3>
              <p className="text-sm leading-6 text-slate-400">
                {canLoadMoreWhenEmpty
                  ? 'Older matching captures may still be outside the loaded window. Continue searching the archive.'
                  : 'Change the platform filter or collect a new link from the capture panel.'}
              </p>
              {canLoadMoreWhenEmpty && (
                <div className="mx-auto mt-2 grid gap-3">
                  <Button
                    type="button"
                    onClick={onLoadMore}
                    disabled={isLoadingMore}
                    className="h-10 rounded-md bg-cyan-300 px-4 font-black text-slate-950 hover:bg-cyan-200"
                  >
                    <RefreshCw className={`mr-2 size-4 ${isLoadingMore ? 'animate-spin' : ''}`} />
                    {isLoadingMore ? 'Searching...' : 'Search older captures'}
                  </Button>
                  <InfiniteScroll
                    onLoadMore={onLoadMore}
                    hasMore={hasMore}
                    isLoadingMore={isLoadingMore}
                  />
                </div>
              )}
            </div>
          </CommandCenterSurface>
        ) : (
          <>
            {posts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                onClick={() => onPostClick(post)} 
              />
            ))}

            <InfiniteScroll 
              onLoadMore={onLoadMore}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
            />
          </>
        )}
      </GsapReveal>
    </div>
  );
});
