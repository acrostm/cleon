'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Timeline } from '@/components/Timeline';
import { FloatingActionMenu } from '@/components/FloatingActionMenu';
import { PostDetailModal } from '@/components/PostDetailModal';
import { Post } from '@/components/PostCard';
import { toast } from 'sonner';
import { AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HeaderSpotifyPlayer } from '@/components/HeaderSpotifyPlayer';
import { Separator } from '@/components/ui/separator';
import { ScrollToTop } from '@/components/ScrollToTop';
import { CrossPlatformClipboard } from '@/components/CrossPlatformClipboard';

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  
  const hasScrolledRef = useRef(false);
  const topPostIdRef = useRef<string | null>(null);

  // Sync ref with state
  useEffect(() => {
    topPostIdRef.current = posts.length > 0 ? posts[0].id : null;
  }, [posts]);

  // Stable event handlers
  const handlePostClick = useCallback((post: Post) => {
    setSelectedPost(post);
  }, []);

  const fetchMorePosts = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/feed?cursor=${nextCursor}&limit=10`);
      const data = await res.json();
      
      if (data.success) {
        setPosts(prev => [...prev, ...data.data]);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
    } catch (err) {
      console.error('Failed to fetch more posts:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore]);

  const handleSubmit = useCallback(async (url: string) => {
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
  }, []);

  const handleDelete = useCallback(async (postId: string) => {
    try {
      const res = await fetch(`/api/feed/${postId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      
      if (data.success) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        toast.success('Post removed from timeline');
        return true;
      } else {
        toast.error(data.error || 'Failed to delete post');
        return false;
      }
    } catch (err) {
      console.error('[Delete Error]:', err);
      toast.error('Failed to delete post');
      return false;
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedPost(null);
  }, []);

  // Initial Fetch
  useEffect(() => {
    const fetchInitialPosts = async () => {
      try {
        const res = await fetch('/api/feed?limit=10');
        const data = await res.json();
        if (data.success) {
          setPosts(data.data);
          setNextCursor(data.nextCursor);
          setHasMore(data.hasMore);
        }
      } catch (err) {
        console.error('Failed to fetch initial posts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialPosts();
  }, []);

  // Stable Polling: Uses ref to avoid resetting interval
  useEffect(() => {
    if (isLoading) return;

    const pollNewPosts = async () => {
      try {
        const sinceId = topPostIdRef.current;
        const url = sinceId ? `/api/feed?since=${sinceId}` : '/api/feed?limit=10';
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.success && data.data.length > 0) {
          setPosts(prev => {
            const newPosts = data.data.filter((newP: Post) => !prev.find(p => p.id === newP.id));
            if (newPosts.length === 0) return prev;
            return [...newPosts, ...prev];
          });
          
          if (!sinceId) {
            setNextCursor(data.nextCursor);
            setHasMore(data.hasMore);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    const intervalId = setInterval(pollNewPosts, 5000);
    return () => clearInterval(intervalId);
  }, [isLoading]); 

  // Scroll to hash on initial load
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

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors duration-500 selection:bg-indigo-500/10 dark:selection:bg-indigo-500/30">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-16 flex flex-col min-h-screen">
        
        {/* Site Header */}
        <header className="flex items-start justify-end mb-12 md:mb-20">
           <div className="flex items-center gap-2 md:gap-4">
              <HeaderSpotifyPlayer />
              <ThemeToggle />
           </div>
        </header>

        <section className="mb-12 md:mb-16">
          <CrossPlatformClipboard />
        </section>

        <div className="flex-1">
          <Timeline 
            posts={posts} 
            isLoading={isLoading} 
            isSubmitting={isSubmitting} 
            onPostClick={handlePostClick}
            onLoadMore={fetchMorePosts}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
          />
        </div>

        {/* Branding Footer */}
        {!isLoading && posts.length > 0 && !hasMore && (
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

      <ScrollToTop />

      <AnimatePresence>
        {selectedPost && (
          <PostDetailModal 
            post={selectedPost} 
            onClose={handleCloseModal}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
