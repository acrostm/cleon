"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Archive,
  Bell,
  ClipboardCheck,
  Command,
  Filter,
  Inbox,
  Link2,
  LogOut,
  Plus,
  Radar,
  RefreshCw,
  Satellite,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { CommandCenterBackground } from "@/components/command-center/CommandCenterBackground";
import { CommandCenterSurface } from "@/components/command-center/CommandCenterSurface";
import { HeaderSpotifyPlayer } from "@/components/HeaderSpotifyPlayer";
import { PostDetailModal } from "@/components/PostDetailModal";
import { ScrollToTop } from "@/components/ScrollToTop";
import { SubmitUrlForm } from "@/components/SubmitUrlForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Timeline } from "@/components/Timeline";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { gsap, useGSAP } from "@/lib/gsap-client";
import {
  platformMeta,
  platformValues,
  type Platform,
  type PlatformFilter,
  type Post,
} from "@/lib/post-types";
import type { FeedSummary } from "@/lib/feed-summary";
import { cn } from "@/lib/utils";

const filterOptions: Array<{ value: PlatformFilter; label: string }> = [
  { value: "ALL", label: "All" },
  ...platformValues.map((value) => ({ value, label: platformMeta[value].label })),
];

function uniqueById(items: Post[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function HomeExperience() {
  const scope = useRef<HTMLDivElement>(null);
  const topPostIdRef = useRef<string | null>(null);
  const postsRef = useRef<Post[]>([]);
  const pendingPostsRef = useRef<Post[]>([]);
  const hasScrolledRef = useRef(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const [summary, setSummary] = useState<FeedSummary | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [filter, setFilter] = useState<PlatformFilter>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return;

      gsap.from("[data-cc-entrance]", {
        autoAlpha: 0,
        y: 18,
        filter: "blur(12px)",
        duration: 0.86,
        ease: "power3.out",
        stagger: 0.065,
      });
    },
    { scope },
  );

  useEffect(() => {
    postsRef.current = posts;
    topPostIdRef.current = posts.length > 0 ? posts[0].id : null;
  }, [posts]);

  useEffect(() => {
    pendingPostsRef.current = pendingPosts;
  }, [pendingPosts]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandOpen((open) => !open);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "u") {
        event.preventDefault();
        setIsCaptureOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredPosts = useMemo(() => {
    if (filter === "ALL") return posts;
    return posts.filter((post) => post.platform === filter);
  }, [filter, posts]);

  const loadedPlatformCounts = useMemo(() => {
    const counts: Partial<Record<Platform, number>> = {};
    posts.forEach((post) => {
      counts[post.platform] = (counts[post.platform] ?? 0) + 1;
    });
    return counts;
  }, [posts]);

  const newestPost = posts[0];
  const platformCounts = summary?.platformCounts ?? loadedPlatformCounts;
  const totalPosts = summary?.totalPosts ?? posts.length;
  const mediaCount = summary?.totalMedia ?? posts.reduce((total, post) => total + post.mediaUrls.length, 0);
  const activeSources = summary?.totalSources ?? Object.keys(loadedPlatformCounts).length;
  const filteredTotalCount = filter === "ALL" ? totalPosts : platformCounts[filter] ?? 0;
  const timelineHasMore = filter === "ALL" ? hasMore : hasMore && filteredPosts.length < filteredTotalCount;

  const fetchInitialPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/feed?limit=10&includeSummary=1");
      const data = await res.json();
      if (data.success) {
        setPosts(data.data);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
        if (data.summary) setSummary(data.summary);
      } else {
        console.error("[Feed Initial API Error]:", data.error, data.details || "");
        toast.error(data.error || "Failed to fetch timeline");
      }
    } catch (err) {
      console.error("[Feed Initial Network Error]:", err);
      toast.error("Failed to fetch timeline");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInitialPosts();
  }, [fetchInitialPosts]);

  const fetchMorePosts = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/feed?cursor=${nextCursor}&limit=10`);
      const data = await res.json();

      if (data.success) {
        setPosts((prev) => uniqueById([...prev, ...data.data]));
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } else {
        console.error("[Feed More API Error]:", data.error, data.details || "");
        toast.error(data.error || "Failed to fetch more posts");
      }
    } catch (err) {
      console.error("[Feed More Network Error]:", err);
      toast.error("Failed to fetch more posts");
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore]);

  const handleSubmit = useCallback(async (url: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (data.success) {
        setPosts((prev) => uniqueById([data.data, ...prev]));
        setPendingPosts((prev) => prev.filter((post) => post.id !== data.data.id));
        if (data.summary) setSummary(data.summary);
        toast.success("Captured into command center");
        return true;
      }

      console.error("[API Error]:", data.error, data.details || "");
      toast.error(data.error || "Failed to parse URL");
      return false;
    } catch (err) {
      console.error("[Network Catch Error]:", err);
      toast.error("Network error");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const handleDelete = useCallback(async (postId: string) => {
    try {
      const res = await fetch(`/api/feed/${postId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        setPosts((prev) => prev.filter((post) => post.id !== postId));
        setPendingPosts((prev) => prev.filter((post) => post.id !== postId));
        if (data.summary) setSummary(data.summary);
        toast.success("Post removed from timeline");
        return true;
      }

      console.error("[Delete API Error]:", data.error, data.details || "");
      toast.error(data.error || "Failed to delete post");
      return false;
    } catch (err) {
      console.error("[Delete Error]:", err);
      toast.error("Failed to delete post");
      return false;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null;
        console.error("[Owner Logout Error]:", data?.error || res.statusText);
        toast.error(data?.error || "Failed to lock Cleon");
        return;
      }

      window.location.assign("/");
    } catch (err) {
      console.error("[Owner Logout Network Error]:", err);
      toast.error("Failed to lock Cleon");
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const pollNewPosts = async () => {
      try {
        const sinceId = topPostIdRef.current;
        const url = sinceId ? `/api/feed?since=${sinceId}` : "/api/feed?limit=10";
        const res = await fetch(url);
        const data = await res.json();

        if (data.success && data.data.length > 0) {
          setPendingPosts((current) => {
            const existing = new Set([...current, ...pendingPostsRef.current, ...postsRef.current].map((post) => post.id));
            return [...data.data.filter((post: Post) => !existing.has(post.id)), ...current];
          });
        } else if (!data.success) {
          console.error("[Feed Poll API Error]:", data.error, data.details || "");
        }
      } catch (err) {
        console.error("[Feed Poll Network Error]:", err);
      }
    };

    const intervalId = window.setInterval(pollNewPosts, 6000);
    return () => window.clearInterval(intervalId);
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading && posts.length > 0 && !hasScrolledRef.current && window.location.hash) {
      const id = window.location.hash.substring(1);
      const element = document.getElementById(id);
      if (element) {
        window.setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("ring-3", "ring-cyan-300/40");
          window.setTimeout(() => element.classList.remove("ring-3", "ring-cyan-300/40"), 2200);
        }, 100);
      }
      hasScrolledRef.current = true;
    }
  }, [posts, isLoading]);

  const releasePendingPosts = () => {
    setPosts((prev) => uniqueById([...pendingPosts, ...prev]));
    setPendingPosts([]);
  };

  const openCapture = () => {
    setIsCommandOpen(false);
    setIsCaptureOpen(true);
  };

  return (
    <main ref={scope} className="min-h-screen overflow-x-hidden text-slate-100 selection:bg-cyan-300/20">
      <CommandCenterBackground />

      <div className="mx-auto grid min-h-screen w-full max-w-[1500px] grid-cols-1 gap-5 px-4 pb-28 pt-4 md:px-6 md:pb-12 lg:grid-cols-[16rem_minmax(0,1fr)_22rem] lg:pt-6">
        <aside data-cc-entrance className="hidden lg:block">
          <CommandCenterSurface className="sticky top-6 grid gap-5 rounded-lg p-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200/80">Cleon</p>
              <h1 className="mt-3 text-3xl font-black tracking-normal text-white">Command Center</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">Personal signal intake, device relay, and notification ops in one cockpit.</p>
            </div>

            <div className="grid gap-2">
              <Link className="flex items-center gap-3 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2.5 text-sm font-bold text-cyan-100" href="/">
                <Activity className="size-4" />
                Timeline Feed
              </Link>
              <Link className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.08]" href="/clipboard">
                <ClipboardCheck className="size-4" />
                Device Relay
              </Link>
              <Link className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.08]" href="/admin/bark">
                <Bell className="size-4" />
                Bark Console
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Metric label="Posts" value={totalPosts} />
              <Metric label="Sources" value={activeSources} />
              <Metric label="Media" value={mediaCount} />
              <Metric label="Queued" value={pendingPosts.length} />
            </div>
          </CommandCenterSurface>
        </aside>

        <section className="min-w-0">
          <header data-cc-entrance className="mb-5 flex flex-col gap-4 rounded-lg border border-white/10 bg-white/[0.05] p-4 backdrop-blur-2xl md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200/80">
                  <Satellite className="size-4" />
                  Live Intake
                </div>
                <h2 className="mt-3 text-3xl font-black tracking-normal text-white md:text-5xl">Signal timeline</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">
                  Collect links from web, Feishu, social platforms, and device relay into a calmer high-signal feed.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setIsCommandOpen(true)} className="h-10 rounded-md border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]">
                  <Command className="size-4" />
                  <span className="hidden sm:inline">Command</span>
                </Button>
                <ThemeToggle />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                <Filter className="size-3.5" />
                Filter
              </span>
              {filterOptions.map((option) => {
                const active = filter === option.value;
                const count = option.value === "ALL" ? totalPosts : platformCounts[option.value] ?? 0;
                return (
                  <button
                    key={option.value}
                    type="button"
                    data-platform-filter={option.value}
                    onClick={() => setFilter(option.value)}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-cyan-300/30",
                      active
                        ? "border-cyan-300/35 bg-cyan-300/15 text-cyan-100"
                        : "border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200",
                    )}
                  >
                    {option.label}
                    <span className="ml-1.5 text-slate-500">{count}</span>
                  </button>
                );
              })}
            </div>
          </header>

          <AnimatePresence>
            {pendingPosts.length > 0 && (
              <motion.button
                type="button"
                onClick={releasePendingPosts}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-5 flex w-full items-center justify-between rounded-lg border border-emerald-300/25 bg-emerald-300/12 px-4 py-3 text-left text-sm font-bold text-emerald-100 shadow-[0_18px_60px_rgba(16,185,129,0.12)]"
              >
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="size-4" />
                  {pendingPosts.length} new capture{pendingPosts.length > 1 ? "s" : ""} ready
                </span>
                <span className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">Insert</span>
              </motion.button>
            )}
          </AnimatePresence>

          <div data-cc-entrance>
            <Timeline
              posts={filteredPosts}
              isLoading={isLoading}
              isSubmitting={isSubmitting}
              onPostClick={setSelectedPost}
              onLoadMore={fetchMorePosts}
              hasMore={timelineHasMore}
              isLoadingMore={isLoadingMore}
              canLoadMoreWhenEmpty={filter !== "ALL" && timelineHasMore}
            />
          </div>
        </section>

        <aside data-cc-entrance className="hidden lg:block">
          <div className="sticky top-6 grid gap-5">
            <CommandCenterSurface className="rounded-lg p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200/80">Capture</p>
                  <h3 className="mt-1 text-xl font-black text-white">Drop a source</h3>
                </div>
                <span className="grid size-10 place-items-center rounded-md bg-cyan-300/12 text-cyan-100">
                  <Link2 className="size-5" />
                </span>
              </div>
              <SubmitUrlForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
            </CommandCenterSurface>

            <CommandCenterSurface className="rounded-lg p-4">
              <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                <Radar className="size-4 text-cyan-200" />
                System Insight
              </div>
              <div className="grid gap-3 text-sm">
                <Insight label="Latest" value={newestPost ? newestPost.authorName : "Waiting for signal"} />
                <Insight label="Active filter" value={filter === "ALL" ? "All platforms" : platformMeta[filter].label} />
                <Insight label="Poll cadence" value="6s buffered" />
              </div>
            </CommandCenterSurface>

            <div className="hidden xl:block">
              <HeaderSpotifyPlayer />
            </div>
          </div>
        </aside>
      </div>

      <MobileDock onCapture={openCapture} onCommand={() => setIsCommandOpen(true)} />

      <Dialog open={isCaptureOpen} onOpenChange={setIsCaptureOpen}>
        <DialogContent showCloseButton className="rounded-lg border-white/10 bg-[#0b0f17]/95 p-5 text-slate-100 shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-white">Collect content</DialogTitle>
            <DialogDescription className="text-slate-400">Paste a supported URL and Cleon will parse it into your timeline.</DialogDescription>
          </DialogHeader>
          <SubmitUrlForm
            onSubmit={async (url) => {
              const ok = await handleSubmit(url);
              if (ok) setIsCaptureOpen(false);
              return ok;
            }}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <CommandPalette
        open={isCommandOpen}
        onOpenChange={setIsCommandOpen}
        onCapture={() => {
          setIsCommandOpen(false);
          window.setTimeout(() => setIsCaptureOpen(true), 120);
        }}
        onRefresh={() => {
          setIsCommandOpen(false);
          void fetchInitialPosts();
        }}
        onLogout={() => {
          setIsCommandOpen(false);
          void handleLogout();
        }}
      />

      <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} onDelete={handleDelete} />
      <ScrollToTop />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
    </div>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <span className="text-slate-500">{label}</span>
      <span className="truncate text-right font-bold text-slate-200">{value}</span>
    </div>
  );
}

function MobileDock({ onCapture, onCommand }: { onCapture: () => void; onCommand: () => void }) {
  return (
    <nav className="fixed inset-x-3 bottom-4 z-40 grid grid-cols-5 gap-2 rounded-lg border border-white/10 bg-[#0b0f17]/90 p-2 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl lg:hidden">
      <DockButton icon={Plus} label="Collect" onClick={onCapture} />
      <DockLink icon={ClipboardCheck} label="Relay" href="/clipboard" />
      <DockLink icon={Archive} label="Archive" href="/archive" />
      <DockLink icon={Bell} label="Bark" href="/admin/bark" />
      <DockButton icon={Command} label="Cmd" onClick={onCommand} />
    </nav>
  );
}

function DockButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="grid place-items-center gap-1 rounded-md px-2 py-2 text-[11px] font-bold text-slate-300 transition hover:bg-white/[0.08]">
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function DockLink({ icon: Icon, label, href }: { icon: LucideIcon; label: string; href: string }) {
  return (
    <Link href={href} className="grid place-items-center gap-1 rounded-md px-2 py-2 text-[11px] font-bold text-slate-300 transition hover:bg-white/[0.08]">
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

function CommandPalette({
  open,
  onOpenChange,
  onCapture,
  onRefresh,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: () => void;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!open || !scope.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(".command-item", {
        autoAlpha: 0,
        x: -10,
        duration: 0.36,
        ease: "power2.out",
        stagger: 0.045,
      });
    },
    { scope, dependencies: [open] },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="rounded-lg border-white/10 bg-[#0b0f17]/95 p-0 text-slate-100 shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:max-w-xl">
        <div ref={scope} className="p-3">
          <div className="mb-3 flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2">
            <Search className="size-4 text-slate-500" />
            <p className="text-sm font-bold text-slate-300">Command palette</p>
            <span className="ml-auto rounded border border-white/10 px-1.5 py-0.5 text-[10px] font-black text-slate-500">⌘K</span>
          </div>
          <div className="grid gap-2">
            <CommandItem icon={Link2} label="Collect URL" detail="Open capture composer" onClick={onCapture} />
            <CommandItem icon={RefreshCw} label="Refresh timeline" detail="Reload latest feed window" onClick={onRefresh} />
            <CommandHref icon={ClipboardCheck} label="Device Relay" detail="Open cross-platform clipboard" href="/clipboard" />
            <CommandHref icon={Archive} label="XHS Archive" detail="Open public content archive" href="/archive" />
            <CommandHref icon={Bell} label="Bark Console" detail="Manage notification endpoints" href="/admin/bark" />
            <CommandItem icon={LogOut} label="Lock Cleon" detail="Clear this device session" onClick={onLogout} />
            <CommandItem icon={Inbox} label="Close palette" detail="Return to the feed" onClick={() => onOpenChange(false)} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommandItem({ icon: Icon, label, detail, onClick }: { icon: LucideIcon; label: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="command-item flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/10">
      <span className="grid size-10 place-items-center rounded-md bg-white/[0.06] text-cyan-100">
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-sm font-black text-white">{label}</span>
        <span className="mt-1 block text-xs text-slate-500">{detail}</span>
      </span>
    </button>
  );
}

function CommandHref({ icon: Icon, label, detail, href }: { icon: LucideIcon; label: string; detail: string; href: string }) {
  return (
    <Link href={href} className="command-item flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/10">
      <span className="grid size-10 place-items-center rounded-md bg-white/[0.06] text-cyan-100">
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-sm font-black text-white">{label}</span>
        <span className="mt-1 block text-xs text-slate-500">{detail}</span>
      </span>
    </Link>
  );
}
