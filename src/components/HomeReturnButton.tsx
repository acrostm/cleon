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
        "group inline-flex h-10 items-center gap-2 rounded-full border border-slate-200/80 bg-white/75 px-3 text-sm font-semibold text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-slate-950 hover:shadow-[0_16px_38px_rgba(15,23,42,0.12)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-slate-400/30 dark:border-white/10 dark:bg-white/[0.07] dark:text-slate-200 dark:shadow-[0_14px_42px_rgba(0,0,0,0.35)] dark:hover:border-white/20 dark:hover:bg-white/[0.11] dark:hover:text-white",
        className,
      )}
      aria-label="返回主页"
    >
      <span className="flex size-6 items-center justify-center rounded-full bg-slate-950 text-white transition duration-300 group-hover:-translate-x-0.5 dark:bg-white dark:text-slate-950">
        <ArrowLeft className="size-3.5" />
      </span>
      返回主页
    </Link>
  );
}
