import prisma from '@/lib/prisma';

export type FeedSummary = {
  totalPosts: number;
  totalMedia: number;
  totalSources: number;
  platformCounts: Record<string, number>;
};

export async function getFeedSummary(): Promise<FeedSummary> {
  const [totalPosts, platformRows, mediaRows] = await Promise.all([
    prisma.post.count(),
    prisma.$queryRaw<Array<{ platform: string; count: number | bigint }>>`
      SELECT "platform", COUNT(*)::int AS "count"
      FROM "Post"
      GROUP BY "platform"
      ORDER BY "platform" ASC
    `,
    prisma.$queryRaw<Array<{ totalMedia: number | bigint | null }>>`
      SELECT COALESCE(SUM(cardinality("mediaUrls")), 0)::int AS "totalMedia"
      FROM "Post"
    `,
  ]);

  const platformCounts = Object.fromEntries(
    platformRows.map((row) => [row.platform, Number(row.count)]),
  );

  return {
    totalPosts,
    totalMedia: Number(mediaRows[0]?.totalMedia ?? 0),
    totalSources: platformRows.length,
    platformCounts,
  };
}
