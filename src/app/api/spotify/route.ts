import { NextRequest, NextResponse } from "next/server";

import { requireOwnerRequest } from "@/lib/auth/session";

type SpotifyPreview = {
  title: string;
  artist: string;
  image?: string;
  link: string;
  audio?: string;
};

type SpotifyUrlInfoFactory = (fetcher: typeof fetch) => {
  getPreview: (url: string) => Promise<{
    title: string;
    artist: string;
    image?: string;
    link: string;
    audio?: string;
  }>;
};

function normalizeSpotifyUrl(url: string): string {
  return url.replace(/\/intl-[a-z]{2}\//, "/");
}

function isSpotifyUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:")
      && (url.hostname === "open.spotify.com" || url.hostname.endsWith(".spotify.com"));
  } catch {
    return false;
  }
}

async function getSpotifyPreview(url: string): Promise<SpotifyPreview> {
  const spotifyModule = await import("spotify-url-info") as unknown as {
    default?: SpotifyUrlInfoFactory;
  } & SpotifyUrlInfoFactory;
  const createSpotifyUrlInfo = spotifyModule.default ?? spotifyModule;
  return createSpotifyUrlInfo(fetch).getPreview(url);
}

export async function GET(request: NextRequest) {
  const unauthorized = requireOwnerRequest(request);
  if (unauthorized) return unauthorized;

  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  if (!isSpotifyUrl(url)) {
    return NextResponse.json({ error: "Only Spotify URLs are supported" }, { status: 400 });
  }

  try {
    const normalizedUrl = normalizeSpotifyUrl(url);
    const data = await getSpotifyPreview(normalizedUrl);

    return NextResponse.json({
      title: data.title,
      artist: data.artist,
      image: data.image || "",
      link: data.link,
      audio: data.audio,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch Spotify data" },
      { status: 500 }
    );
  }
}
