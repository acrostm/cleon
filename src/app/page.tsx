'use client';

import { useState, useEffect } from 'react';
import { Timeline } from '@/components/Timeline';
import { FloatingActionMenu } from '@/components/FloatingActionMenu';
import { Post } from '@/components/PostCard';
import { toast } from 'sonner';

export default function Home() {
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
        return true; // Return success for modal closing
      } else {
        console.error('[API Error]:', data.error, data.details || '');
        toast.error(data.error || 'Failed to parse URL');
        return false;
      }
    } catch (err) {
      console.error('[Network Catch Error]:', err);
      toast.error('Network error');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 lg:py-12">
      <div className="max-w-2xl mx-auto flex flex-col min-h-[calc(100vh-6rem)]">
        <Timeline 
          posts={posts} 
          isLoading={isLoading} 
          isSubmitting={isSubmitting} 
        />

        {/* Branding Footer */}
        {!isLoading && posts.length > 0 && (
          <footer className="mt-16 pt-12 border-t border-slate-200/60 dark:border-slate-800/60 text-center">
            <h1 className="text-3xl font-extrabold tracking-tighter text-slate-300 dark:text-slate-800 transition-colors hover:text-indigo-500/20">
              Cleon
            </h1>
          </footer>
        )}
      </div>

      <FloatingActionMenu 
        onSubmit={handleSubmit} 
        isSubmitting={isSubmitting} 
      />
    </main>
  );
}
