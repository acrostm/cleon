import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { deleteMediaFromR2 } from '@/lib/r2';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    const post = await prisma.post.findUnique({
      where: { id },
      select: { mediaUrls: true }
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Try deleting all media from R2 first
    for (const url of post.mediaUrls) {
      const success = await deleteMediaFromR2(url);
      if (!success) {
        return NextResponse.json({ 
          error: 'Failed to delete associated media from storage. Post was not deleted.' 
        }, { status: 500 });
      }
    }

    await prisma.post.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: 'Post and associated media deleted successfully' });
  } catch (error: any) {
    console.error('[API Error] Failed to delete post:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to delete post',
      details: process.env.NODE_ENV !== 'production' ? error.stack : undefined 
    }, { status: 500 });
  }
}

