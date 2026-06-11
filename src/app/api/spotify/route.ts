import { NextRequest, NextResponse } from "next/server";

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

async function getSpotifyPreview(url: string): Promise<SpotifyPreview> {
  const spotifyModule = await import("spotify-url-info") as unknown as {
    default?: SpotifyUrlInfoFactory;
  } & SpotifyUrlInfoFactory;
  const createSpotifyUrlInfo = spotifyModule.default ?? spotifyModule;
  return createSpotifyUrlInfo(fetch).getPreview(url);
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
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
