"use client";

import { SpotifyCard } from "@/components/spotify-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SiSpotify } from "@icons-pack/react-simple-icons";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

export function HeaderSpotifyPlayer() {
  const spotifyUrl = "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT";

  return (
    <div className="flex items-center">
      {/* Desktop View: Show the full card */}
      <div className="hidden md:block w-72 lg:w-80 transition-all hover:scale-[1.02]">
        <SpotifyCard url={spotifyUrl} className="shadow-lg border-primary/10" />
      </div>

      {/* Mobile/Small Tablet View: Show an icon that opens the card in a dialog */}
      <div className="md:hidden">
        <Dialog>
          <DialogTrigger className={cn(buttonVariants({ variant: "outline", size: "icon" }), "rounded-full w-10 h-10 border-[#1DB954]/20 bg-[#1DB954]/10 hover:bg-[#1DB954]/20")}>
            <SiSpotify size={20} color="#1DB954" />
          </DialogTrigger>
          <DialogContent showCloseButton={false} className="p-0 border-none bg-transparent shadow-none ring-0 max-w-[85vw] flex items-center justify-center">
            <div className="w-full">
              <SpotifyCard url={spotifyUrl} className="shadow-2xl border-[#1DB954]/20 bg-background" />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
