import { cookies } from "next/headers";

import { AccessGate } from "@/components/auth/AccessGate";
import { CrossPlatformClipboard } from "@/components/CrossPlatformClipboard";
import { CommandCenterBackground } from "@/components/command-center/CommandCenterBackground";
import { HomeReturnButton } from "@/components/HomeReturnButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isOwnerSessionValue, OWNER_SESSION_COOKIE } from "@/lib/auth/session";

export default async function ClipboardPage() {
  const cookieStore = await cookies();
  const isOwner = isOwnerSessionValue(cookieStore.get(OWNER_SESSION_COOKIE)?.value);

  if (!isOwner) {
    return <AccessGate redirectPath="/clipboard" />;
  }

  return (
    <main className="min-h-screen overflow-x-hidden text-slate-100 selection:bg-cyan-300/20">
      <CommandCenterBackground />
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 md:px-6 md:py-10">
        <header className="mb-6 flex items-center justify-between gap-4">
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
