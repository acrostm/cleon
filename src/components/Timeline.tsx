'use client';

import { useEffect, useRef } from 'react';
import { PostCard, Post } from './PostCard';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  posts: Post[];
  isLoading: boolean;
  isSubmitting: boolean;
}

export function Timeline({ posts, isLoading, isSubmitting }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isLoading || posts.length === 0) return;

    // We use a small delay to ensure the DOM has actually rendered the new cards
    const timeoutId = setTimeout(() => {
      if (isFirstLoad.current) {
        // Instant jump for initial load to avoid flicker
        bottomRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
        isFirstLoad.current = false;
      } else {
        // Smooth scroll for subsequent updates (like adding a new URL)
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [posts.length, isLoading]);

  return (
    <div className="relative space-y-12 pb-20">
      {/* The Vertical Rail Line */}
      {!isLoading && posts.length > 0 && (
        <div className="absolute left-[39px] md:left-[103px] top-6 bottom-6 w-px bg-slate-200/60 dark:bg-slate-800/60" />
      )}

      <div className="space-y-12">
        {isSubmitting && (
          <div className="p-6 rounded-3xl bg-white dark:bg-black/40 border border-slate-200 dark:border-slate-800 shadow-xl shadow-indigo-500/5 space-y-4">
             <div className="flex items-center space-x-4">
               <Skeleton className="h-12 w-12 rounded-full" />
               <div className="space-y-2">
                 <Skeleton className="h-4 w-[200px]" />
                 <Skeleton className="h-4 w-[150px]" />
               </div>
             </div>
             <Skeleton className="h-[200px] w-full rounded-2xl" />
          </div>
        )}

        {isLoading ? (
          <div className="space-y-6">
             {[1,2,3].map(i => <Skeleton key={i} className="h-64 w-full rounded-3xl" />)}
          </div>
        ) : (
          posts.map(post => <PostCard key={post.id} post={post} />)
        )}
        
        {/* Invisible Anchor for Scroll Target */}
        <div ref={bottomRef} className="h-1" />
      </div>
    </div>
  );
}
