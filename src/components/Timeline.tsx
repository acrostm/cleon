'use client';

import { PostCard, Post } from './PostCard';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  posts: Post[];
  isLoading: boolean;
  isSubmitting: boolean;
}

export function Timeline({ posts, isLoading, isSubmitting }: Props) {
  return (
    <div className="space-y-6">
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
    </div>
  );
}
