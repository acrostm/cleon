"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Loader2, LockKeyhole, MessageSquare, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { CommandCenterBackground } from "@/components/command-center/CommandCenterBackground";
import { Button } from "@/components/ui/button";

type AccessGateProps = {
  redirectPath?: string;
};

function getRedirectPath(fallback: string) {
  if (typeof window === "undefined") return fallback;

  const next = new URLSearchParams(window.location.search).get("next");
  if (next?.startsWith("/")) return next;

  return fallback;
}

export function AccessGate({ redirectPath = "/" }: AccessGateProps) {
  const [accessKey, setAccessKey] = useState("");
  const [message, setMessage] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const resolvedRedirectPath = useMemo(() => getRedirectPath(redirectPath), [redirectPath]);

  const handleUnlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessKey.trim() || isUnlocking) return;

    setIsUnlocking(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey }),
      });
      const data = await response.json().catch(() => null) as { error?: string; success?: boolean } | null;

      if (!response.ok || !data?.success) {
        console.error("[Owner Unlock Error]:", data?.error || response.statusText);
        toast.error(data?.error || "Unable to unlock Cleon");
        return;
      }

      window.location.assign(resolvedRedirectPath);
    } catch (error) {
      console.error("[Owner Unlock Network Error]:", error);
      toast.error("Unable to unlock Cleon");
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleAccessRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim() || isRequesting) return;

    setIsRequesting(true);
    try {
      const response = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          path: resolvedRedirectPath,
        }),
      });
      const data = await response.json().catch(() => null) as { error?: string; success?: boolean } | null;

      if (!response.ok || !data?.success) {
        console.error("[Access Request Error]:", data?.error || response.statusText);
        toast.error(data?.error || "Unable to send request");
        return;
      }

      setRequestSent(true);
      setMessage("");
      toast.success("Request sent");
    } catch (error) {
      console.error("[Access Request Network Error]:", error);
      toast.error("Unable to send request");
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden text-slate-100 selection:bg-cyan-300/20">
      <CommandCenterBackground />
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-6 px-4 py-8 md:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1fr)]">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="min-w-0"
        >
          <div className="inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
            <ShieldCheck className="size-4" />
            Personal Gate
          </div>
          <h1 className="mt-5 max-w-2xl text-4xl font-black leading-tight tracking-normal text-white md:text-6xl">
            Cleon is locked.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400 md:text-base">
            Owner devices can unlock the command center. Visitors can leave a short request and I will receive it on Bark.
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.62, ease: "easeOut", delay: 0.08 }}
          className="grid gap-4"
        >
          <form
            onSubmit={handleUnlock}
            className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.065] p-4 shadow-[0_28px_100px_rgba(8,145,178,0.14)] backdrop-blur-2xl md:p-5"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-md bg-cyan-300/15 text-cyan-100">
                <LockKeyhole className="size-5" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200/80">Owner</p>
                <h2 className="text-xl font-black text-white">Unlock session</h2>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-lg border border-white/10 bg-black/25 transition focus-within:border-cyan-300/45 focus-within:bg-black/35 focus-within:shadow-[0_0_0_3px_rgba(34,211,238,0.12)]">
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                <KeyRound className="size-3.5 text-cyan-200" />
                Access key
              </div>
              <input
                type="password"
                value={accessKey}
                onChange={(event) => setAccessKey(event.target.value)}
                autoComplete="current-password"
                className="h-14 w-full bg-transparent px-3 text-sm font-medium text-white outline-none placeholder:text-slate-600"
                placeholder="Owner key"
                disabled={isUnlocking}
              />
            </div>

            <Button
              type="submit"
              disabled={!accessKey.trim() || isUnlocking}
              className="mt-4 h-11 w-full rounded-md bg-cyan-300 font-black text-slate-950 transition hover:bg-cyan-200"
            >
              {isUnlocking ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              Unlock
            </Button>
          </form>

          <form
            onSubmit={handleAccessRequest}
            className="overflow-hidden rounded-lg border border-white/10 bg-black/25 p-4 backdrop-blur-2xl md:p-5"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-md bg-white/[0.06] text-slate-200">
                <MessageSquare className="size-5" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Visitor</p>
                <h2 className="text-xl font-black text-white">Request access</h2>
              </div>
            </div>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={500}
              disabled={isRequesting || requestSent}
              placeholder={requestSent ? "Request sent" : "Leave a short note..."}
              className="h-28 w-full resize-none rounded-lg border border-white/10 bg-white/[0.045] px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-white/[0.07] focus:ring-3 focus:ring-cyan-300/10"
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-500">{message.length} / 500</span>
              <Button
                type="submit"
                variant="outline"
                disabled={!message.trim() || isRequesting || requestSent}
                className="h-10 rounded-md border-white/10 bg-white/[0.05] px-4 font-bold text-slate-200 hover:bg-white/[0.1]"
              >
                {isRequesting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {requestSent ? "Sent" : "Send"}
              </Button>
            </div>
          </form>
        </motion.section>
      </div>
    </main>
  );
}
