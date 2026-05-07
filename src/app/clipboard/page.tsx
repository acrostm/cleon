import { CrossPlatformClipboard } from "@/components/CrossPlatformClipboard";
import { HomeReturnButton } from "@/components/HomeReturnButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function ClipboardPage() {
  return (
    <main className="min-h-screen bg-background text-foreground transition-colors duration-500 selection:bg-indigo-500/10 dark:selection:bg-indigo-500/30">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8 md:py-12">
        <header className="mb-8 flex items-center justify-between gap-4">
          <HomeReturnButton />
          <ThemeToggle />
        </header>

        <div className="flex-1">
          <CrossPlatformClipboard />
        </div>
      </div>
    </main>
  );
}
