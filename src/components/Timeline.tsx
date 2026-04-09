'use client';

import { useState, useEffect } from 'react';
import { SubmitUrlForm } from './SubmitUrlForm';
import { PostCard, Post } from './PostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export function Timeline() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/feed')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPosts(data.data);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSubmit = async (url: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      
      if (data.success) {
        setPosts(prev => [data.data, ...prev]);
        toast.success('Successfully added to your timeline');
      } else {
        console.error('[API Error]:', data.error, data.details || '');
        toast.error(data.error || 'Failed to parse URL');
      }
    } catch (err) {
      console.error('[Network Catch Error]:', err);
      toast.error('Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-10">
      <SubmitUrlForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />

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
    </div>
  );
}
