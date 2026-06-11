import { useEffect, useRef, memo } from 'react';
import { Skeleton } from './ui/skeleton';

interface InfiniteScrollProps {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
}

export const InfiniteScroll = memo(function InfiniteScroll({ onLoadMore, hasMore, isLoadingMore }: InfiniteScrollProps) {
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
        <div className="space-y-5">
          <div className="grid animate-pulse gap-3 md:grid-cols-[4.5rem_1fr]">
            <div className="hidden pt-4 text-right md:block">
              <Skeleton className="ml-auto h-3 w-10 bg-white/10" />
              <Skeleton className="ml-auto mt-2 h-2 w-14 bg-white/10" />
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.055] p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-md bg-white/10" />
                <div className="grid flex-1 gap-2">
                  <Skeleton className="h-4 w-[140px] bg-white/10" />
                  <Skeleton className="h-3 w-[100px] bg-white/10" />
                </div>
              </div>
              <Skeleton className="mt-4 h-24 w-full rounded-lg bg-white/10" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
