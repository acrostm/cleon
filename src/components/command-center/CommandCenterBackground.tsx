"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap-client";

export function CommandCenterBackground() {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return;

      gsap.to(".cc-scanline", {
        yPercent: 70,
        opacity: 0.52,
        duration: 8,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });

      gsap.to(".cc-field", {
        xPercent: 6,
        opacity: 0.74,
        duration: 10,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: 1.2,
      });
    },
    { scope },
  );

  return (
    <div ref={scope} className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#06080d]">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(34,211,238,0.14),transparent_28%,rgba(129,140,248,0.1)_58%,transparent_76%),linear-gradient(28deg,transparent_8%,rgba(245,158,11,0.08)_38%,transparent_64%)]" />
      <div className="cc-field absolute inset-y-[-18%] left-[-30%] w-[72%] rotate-[-12deg] bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.10),transparent)] blur-2xl" />
      <div className="cc-field absolute inset-y-[-12%] right-[-28%] w-[64%] rotate-[14deg] bg-[linear-gradient(90deg,transparent,rgba(129,140,248,0.12),transparent)] blur-2xl" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:56px_56px] opacity-35" />
      <div className="cc-scanline absolute inset-x-0 top-[-18%] h-1/2 bg-[linear-gradient(180deg,transparent,rgba(34,211,238,0.08),transparent)] blur-sm" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,8,13,0.12),rgba(6,8,13,0.72)_62%,#06080d_100%)]" />
    </div>
  );
}
