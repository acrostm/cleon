'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger 
        render={
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full w-10 h-10 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
          />
        }
      >
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[130px] border-slate-200 dark:border-slate-800 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 shadow-2xl">
        <DropdownMenuItem 
          onClick={() => setTheme('light')} 
          className="rounded-xl flex items-center gap-2.5 cursor-pointer py-2 focus:bg-indigo-50 dark:focus:bg-indigo-500/10 transition-colors"
        >
          <Sun className="w-4 h-4 text-orange-500" /> 
          <span className="font-medium">Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme('dark')} 
          className="rounded-xl flex items-center gap-2.5 cursor-pointer py-2 focus:bg-indigo-50 dark:focus:bg-indigo-500/10 transition-colors"
        >
          <Moon className="w-4 h-4 text-indigo-400" /> 
          <span className="font-medium">Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme('system')} 
          className="rounded-xl flex items-center gap-2.5 cursor-pointer py-2 focus:bg-indigo-50 dark:focus:bg-indigo-500/10 transition-colors"
        >
          <Monitor className="w-4 h-4 text-slate-500" /> 
          <span className="font-medium">System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
