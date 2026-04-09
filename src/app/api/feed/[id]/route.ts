import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    await prisma.post.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: 'Post deleted successfully' });
  } catch (error: any) {
    console.error('[API Error] Failed to delete post:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to delete post',
      details: process.env.NODE_ENV !== 'production' ? error.stack : undefined 
    }, { status: 500 });
  }
}
