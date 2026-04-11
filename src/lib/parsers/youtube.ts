import { ContentParser, ParsedData } from './index';

export class YoutubeParser implements ContentParser {
  match(url: string): boolean {
    return /youtube\.com|youtu\.be/.test(url);
  }

  async parse(url: string): Promise<ParsedData> {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;

    const res = await fetch(oembedUrl);
    
    if (!res.ok) {
        // Fallback for cases where oEmbed fails
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            throw new Error(`Failed to extract video ID from YouTube URL: ${url}`);
        }
        
        return {
            platform: 'YOUTUBE',
            authorName: 'YouTube User',
            avatarUrl: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=128',
            title: 'YouTube Video',
            contentText: '',
            mediaUrls: [`https://www.youtube.com/embed/${videoId}`],
        };
    }

    const data = await res.json();
    const videoId = this.extractVideoId(url) || '';
    
    // Construct player URL
    const playerUrl = `https://www.youtube.com/embed/${videoId}`;
    
    return {
      platform: 'YOUTUBE',
      authorName: data.author_name || 'YouTube User',
      avatarUrl: `https://www.google.com/s2/favicons?domain=youtube.com&sz=128`,
      title: data.title || '',
      contentText: '',
      mediaUrls: [playerUrl],
    };
  }

  private extractVideoId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  }
}
