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
          className="fixed bottom-36 right-8 z-50"
        >
          <button
            onClick={scrollToTop}
            className="group relative flex items-center justify-center w-14 h-14 rounded-full 
                       bg-white/10 dark:bg-black/20 backdrop-blur-2xl 
                       border border-white/30 dark:border-white/10
                       shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]
                       hover:shadow-[0_8px_32px_0_rgba(99,102,241,0.5)]
                       transition-all duration-700 overflow-hidden"
            aria-label="Scroll to top"
          >
            {/* Animated Liquid Background - Constant subtle flow */}
            <div className="absolute inset-0 z-0 opacity-20 group-hover:opacity-40 transition-opacity duration-700">
               <div className="absolute inset-[-100%] bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.4),transparent_50%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.3),transparent_50%)] animate-[pulse_8s_ease-in-out_infinite] blur-2xl" />
            </div>

            {/* Reflection Shine - Liquid feeling */}
            <motion.div 
              animate={{ 
                x: [-100, 200],
                transition: { duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 1 }
              }}
              className="absolute inset-0 z-10 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-25deg] pointer-events-none" 
            />

            {/* Inner Glass Depth */}
            <div className="absolute inset-[2px] z-0 rounded-full bg-gradient-to-br from-white/10 to-transparent border border-white/5 pointer-events-none" />
            
            {/* Top Light Catch */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50" />

            {/* Icon */}
            <ArrowUp className="relative z-20 w-6 h-6 text-foreground/80 group-hover:text-foreground group-hover:scale-110 transition-all duration-500" />
            
            {/* Liquid Rim Glow */}
            <div className="absolute inset-0 rounded-full border border-white/20 group-hover:border-indigo-500/50 transition-colors duration-500 pointer-events-none" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
