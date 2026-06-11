import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type SurfaceProps = ComponentPropsWithoutRef<"section"> & {
  interactive?: boolean;
};

export function CommandCenterSurface({ className, interactive = false, ...props }: SurfaceProps) {
  return (
    <section
      className={cn(
        "rounded-[1.35rem] border border-white/10 bg-white/[0.055] text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-2xl",
        "supports-[backdrop-filter]:bg-white/[0.06]",
        interactive &&
          "transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.085] hover:shadow-[0_28px_90px_rgba(8,145,178,0.16)]",
        className,
      )}
      {...props}
    />
  );
}
