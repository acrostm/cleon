import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CrossPlatformClipboard } from "@/components/CrossPlatformClipboard";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function ClipboardPage() {
  return (
    <main className="min-h-screen bg-background text-foreground transition-colors duration-500 selection:bg-indigo-500/10 dark:selection:bg-indigo-500/30">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8 md:py-12">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background/70 px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Timeline
          </Link>
          <ThemeToggle />
        </header>

        <div className="flex-1">
          <CrossPlatformClipboard />
        </div>
      </div>
    </main>
  );
}
