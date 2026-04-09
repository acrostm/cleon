'use client';

import { useState, useEffect, useRef } from 'react';
import { Timeline } from '@/components/Timeline';
import { FloatingActionMenu } from '@/components/FloatingActionMenu';
import { PostDetailModal } from '@/components/PostDetailModal';
import { Post } from '@/components/PostCard';
import { toast } from 'sonner';
import { AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Separator } from '@/components/ui/separator';

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (!isLoading && posts.length > 0 && !hasScrolledRef.current) {
      if (window.location.hash) {
        const id = window.location.hash.substring(1);
        const element = document.getElementById(id);
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.style.transition = 'all 1s ease-in-out';
            element.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.5)';
            element.style.transform = 'scale(1.02)';
            setTimeout(() => {
              element.style.boxShadow = 'none';
              element.style.transform = 'none';
            }, 2000);
          }, 100);
        }
      }
      hasScrolledRef.current = true;
    }
  }, [posts, isLoading]);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await fetch('/api/feed');
        const data = await res.json();
        if (data.success) {
          setPosts(prev => {
            // Only update state if there's a structural change (new post or deleted post)
            // to prevent unnecessary React re-renders every few seconds
            const hasChanges = prev.length !== data.data.length || 
              (prev.length > 0 && data.data.length > 0 && prev[0].id !== data.data[0].id);
            return hasChanges ? data.data : prev;
          });
        }
      } catch (err) {
        console.error('Failed to fetch posts:', err);
      }
    };

    // Initial fetch
    fetchPosts().finally(() => setIsLoading(false));

    // Poll every 5 seconds to get updates from Feishu bot or other clients
    const intervalId = setInterval(fetchPosts, 5000);

    return () => clearInterval(intervalId);
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
        return true; 
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

  const handleDelete = async (postId: string) => {
    try {
      const res = await fetch(`/api/feed/${postId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      
      if (data.success) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        toast.success('Post removed from timeline');
      } else {
        toast.error(data.error || 'Failed to delete post');
      }
    } catch (err) {
      console.error('[Delete Error]:', err);
      toast.error('Failed to delete post');
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors duration-500 selection:bg-indigo-500/10 dark:selection:bg-indigo-500/30">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-16 flex flex-col min-h-screen">
        
        {/* Site Header */}
        <header className="flex items-center justify-between mb-12 md:mb-20">
           <div className="flex flex-col">
              <h1 className="text-3xl font-black tracking-tighter text-indigo-600 dark:text-indigo-400 hover:opacity-80 transition-opacity cursor-default uppercase">
                CLEON
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground mt-1">
                Aggregated Stream
              </p>
           </div>
           <ThemeToggle />
        </header>

        <div className="flex-1">
          <Timeline 
            posts={posts} 
            isLoading={isLoading} 
            isSubmitting={isSubmitting} 
            onPostClick={(post) => setSelectedPost(post)}
          />
        </div>

        {/* Branding Footer */}
        {!isLoading && posts.length > 0 && (
          <footer className="mt-24 pb-12 text-center space-y-8">
            <Separator className="opacity-50" />
            <div className="flex flex-col items-center">
               <h2 className="text-4xl font-black tracking-tighter text-muted-foreground/10 dark:text-muted-foreground/5 select-none touch-none uppercase">
                 CLEON
               </h2>
               <p className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-widest mt-2">
                 End of Feed
               </p>
            </div>
          </footer>
        )}
      </div>

      <FloatingActionMenu 
        onSubmit={handleSubmit} 
        isSubmitting={isSubmitting} 
      />

      <AnimatePresence>
        {selectedPost && (
          <PostDetailModal 
            post={selectedPost} 
            onClose={() => setSelectedPost(null)}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
