"use client";

import { SpotifyCard } from "@/components/spotify-card";
import { Button } from "@/components/ui/button";
import { SiSpotify } from "@icons-pack/react-simple-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function HeaderSpotifyPlayer() {
  const spotifyUrl = "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT";

  return (
    <div className="flex items-center">
      {/* Desktop View: Show the full card scaled down slightly */}
      <div className="hidden md:block w-64 transform scale-90 origin-right transition-all hover:scale-95">
        <SpotifyCard url={spotifyUrl} className="shadow-lg border-primary/10" />
      </div>

      {/* Mobile/Small Tablet View: Show an icon that opens the card in a dropdown */}
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="rounded-full w-10 h-10 border-indigo-500/20 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400">
              <SiSpotify size={20} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="p-0 border-none bg-transparent shadow-2xl">
            <div className="w-72 p-1">
              <SpotifyCard url={spotifyUrl} className="shadow-2xl border-indigo-500/20" />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
