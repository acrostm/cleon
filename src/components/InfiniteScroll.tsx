'use client';

import { useEffect, useRef } from 'react';
import { Skeleton } from './ui/skeleton';

interface InfiniteScrollProps {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
}

export function InfiniteScroll({ onLoadMore, hasMore, isLoadingMore }: InfiniteScrollProps) {
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div ref={observerRef} className="pt-8 pb-12">
      {isLoadingMore && (
        <div className="space-y-12">
           {/* Skeleton matching the PostCard layout (simplified) */}
           <div className="flex group relative animate-pulse">
            <div className="hidden md:flex flex-col items-end w-24 pt-8 pr-8 opacity-20">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-2 w-14 mt-2" />
            </div>
            <div className="relative flex flex-col items-center w-12 md:w-16 pt-9">
              <div className="z-10 w-3 h-3 rounded-full bg-muted border-2 border-background" />
            </div>
            <div className="flex-1 pb-8">
              <div className="p-6 rounded-[2rem] bg-card/40 border border-border/50 backdrop-blur-sm space-y-4">
                 <div className="flex items-center space-x-4">
                   <Skeleton className="h-10 w-10 rounded-full" />
                   <div className="space-y-2">
                     <Skeleton className="h-4 w-[140px]" />
                     <Skeleton className="h-3 w-[100px]" />
                   </div>
                 </div>
                 <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
