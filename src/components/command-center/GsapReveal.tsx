"use client";

import { type ReactNode, useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap-client";
import { cn } from "@/lib/utils";

type GsapRevealProps = {
  children: ReactNode;
  className?: string;
  selector?: string;
  y?: number;
  stagger?: number;
};

export function GsapReveal({ children, className, selector = ".gsap-reveal-item", y = 18, stagger = 0.06 }: GsapRevealProps) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return;

      const items = gsap.utils.toArray<HTMLElement>(selector, scope.current);
      if (!items.length) return;

      gsap.from(items, {
        autoAlpha: 0,
        y,
        filter: "blur(10px)",
        duration: 0.78,
        ease: "power3.out",
        stagger,
        scrollTrigger: {
          trigger: scope.current,
          start: "top 86%",
          once: true,
        },
      });

    },
    { scope },
  );

  return (
    <div ref={scope} className={cn(className)}>
      {children}
    </div>
  );
}
