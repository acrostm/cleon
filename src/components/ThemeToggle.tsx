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
            className="h-10 w-10 rounded-md border border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]"
          />
        }
      >
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[130px] rounded-lg border-white/10 bg-[#0b0f17]/90 p-2 text-slate-100 shadow-2xl backdrop-blur-xl">
        <DropdownMenuItem 
          onClick={() => setTheme('light')} 
          className="flex cursor-pointer items-center gap-2.5 rounded-md py-2 transition-colors focus:bg-cyan-300/10"
        >
          <Sun className="w-4 h-4 text-orange-500" /> 
          <span className="font-medium">Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme('dark')} 
          className="flex cursor-pointer items-center gap-2.5 rounded-md py-2 transition-colors focus:bg-cyan-300/10"
        >
          <Moon className="w-4 h-4 text-cyan-200" />
          <span className="font-medium">Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme('system')} 
          className="flex cursor-pointer items-center gap-2.5 rounded-md py-2 transition-colors focus:bg-cyan-300/10"
        >
          <Monitor className="w-4 h-4 text-slate-500" /> 
          <span className="font-medium">System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
