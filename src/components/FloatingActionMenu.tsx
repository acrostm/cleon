'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, User, Palette, Plus, X } from 'lucide-react';
import { SubmitUrlForm } from './SubmitUrlForm';

interface Props {
  onSubmit: (url: string) => Promise<boolean>;
  isSubmitting: boolean;
}

export function FloatingActionMenu({ onSubmit, isSubmitting }: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleUrlSubmit = async (url: string) => {
    const success = await onSubmit(url);
    if (success) {
      setIsModalOpen(false);
      setIsMenuOpen(false);
    }
  };

  return (
    <>
      {/* FAB Group Container */}
      <div className="fixed bottom-8 right-8 flex flex-col items-end space-y-4 z-50">
        
        {/* Floating Settings Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.8 }}
              className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-2 rounded-3xl shadow-2xl flex flex-col space-y-1 mb-2 min-w-[160px]"
            >
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center space-x-3 px-4 py-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200 group"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="font-semibold text-sm">URL Entry</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons Stack */}
        <div className="flex flex-col space-y-4 items-center">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-12 h-12 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <User className="w-5 h-5" />
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-12 h-12 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <Palette className="w-5 h-5" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all ${
              isMenuOpen 
                ? 'bg-indigo-600 text-white rotate-90 shadow-indigo-500/20' 
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Settings className="w-6 h-6" />}
          </motion.button>
        </div>
      </div>

      {/* URL Input Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 md:p-10 shadow-2xl border border-slate-200 dark:border-slate-800 relative z-10"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="space-y-8">
                <div className="space-y-2">
                  <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Collect Content</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base">Paste any URL to summarize and save it to your storage.</p>
                </div>
                
                <SubmitUrlForm onSubmit={handleUrlSubmit} isSubmitting={isSubmitting} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
