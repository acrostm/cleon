'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.8 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="fixed bottom-24 right-5 z-50 lg:bottom-8 lg:right-8"
        >
          <button
            onClick={scrollToTop}
            className="group relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-[#0b0f17]/80 shadow-[0_14px_42px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition duration-300 hover:border-cyan-300/35 hover:bg-white/[0.1] lg:h-12 lg:w-12"
            aria-label="Scroll to top"
          >
            <motion.div 
              animate={{ 
                x: [-100, 200],
                transition: { duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 1 }
              }}
              className="pointer-events-none absolute inset-0 z-10 h-full w-1/2 skew-x-[-25deg] bg-gradient-to-r from-transparent via-cyan-100/20 to-transparent"
            />
            <ArrowUp className="relative z-20 h-5 w-5 text-slate-200 transition duration-300 group-hover:text-cyan-100" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
