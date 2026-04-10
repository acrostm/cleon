import { PostCard, Post } from './PostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { InfiniteScroll } from './InfiniteScroll';

interface Props {
  posts: Post[];
  isLoading: boolean;
  isSubmitting: boolean;
  onPostClick: (post: Post) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
}

export function Timeline({ 
  posts, 
  isLoading, 
  isSubmitting, 
  onPostClick,
  onLoadMore,
  hasMore,
  isLoadingMore
}: Props) {
  return (
    <div className="relative space-y-12 pb-10">
      {/* The Vertical Rail Line */}
      {!isLoading && posts.length > 0 && (
        <div className="absolute left-[24px] md:left-[128px] top-8 bottom-0 w-px bg-border/40" />
      )}

      <div className="space-y-12">
        {isSubmitting && (
          <div className="flex group relative animate-pulse">
            <div className="hidden md:flex flex-col items-end w-24 pt-8 pr-8 opacity-20">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-2 w-14 mt-2" />
            </div>
            <div className="relative flex flex-col items-center w-12 md:w-16 pt-9">
              <div className="z-10 w-3 h-3 rounded-full bg-muted border-2 border-background" />
            </div>
            <div className="flex-1 pb-8">
              <div className="p-6 rounded-[2rem] bg-card/40 border border-border/50 space-y-4">
                 <div className="flex items-center space-x-4">
                   <Skeleton className="h-10 w-10 rounded-full" />
                   <div className="space-y-2">
                     <Skeleton className="h-4 w-[200px]" />
                     <Skeleton className="h-3 w-[150px]" />
                   </div>
                 </div>
                 <Skeleton className="h-[200px] w-full rounded-2xl" />
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-6">
             {[1,2,3].map(i => <Skeleton key={i} className="h-64 w-full rounded-3xl" />)}
          </div>
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
      </div>
    </div>
  );
}
