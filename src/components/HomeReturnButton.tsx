import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

type HomeReturnButtonProps = {
  className?: string;
};

export function HomeReturnButton({ className }: HomeReturnButtonProps) {
  return (
    <Link
      href="/"
      className={cn(
        "group inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm font-bold text-slate-200 shadow-[0_14px_42px_rgba(0,0,0,0.25)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-cyan-300/30",
        className,
      )}
      aria-label="返回主页"
    >
      <span className="flex size-6 items-center justify-center rounded-md bg-cyan-300 text-slate-950 transition duration-300 group-hover:-translate-x-0.5">
        <ArrowLeft className="size-3.5" />
      </span>
      返回主页
    </Link>
  );
}
