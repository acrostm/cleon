import 'server-only';

import crypto from 'crypto';

const SHARE_TOKEN_VERSION = 'v1';

type ShareablePost = {
  id: string;
  createdAt: Date | string;
};

function getShareSecret() {
  return process.env.CLEON_SHARE_SECRET || process.env.CLEON_SESSION_SECRET || '';
}

function normalizeCreatedAt(createdAt: Date | string) {
  return createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt).toISOString();
}

function getShareMessage(post: ShareablePost) {
  return `cleon:post-share:v1:${post.id}:${normalizeCreatedAt(post.createdAt)}`;
}

function signPost(post: ShareablePost) {
  const secret = getShareSecret();
  if (!secret) return null;

  return crypto
    .createHmac('sha256', secret)
    .update(getShareMessage(post))
    .digest('base64url');
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createPostShareToken(post: ShareablePost) {
  const signature = signPost(post);
  if (!signature) return null;

  return `${SHARE_TOKEN_VERSION}.${signature}`;
}

export function isValidPostShareToken(post: ShareablePost, token: string | null | undefined) {
  if (!token) return false;

  const expectedToken = createPostShareToken(post);
  if (!expectedToken) return false;

  return constantTimeEqual(token, expectedToken);
}

export function createPostSharePath(post: ShareablePost) {
  const token = createPostShareToken(post);
  if (!token) return null;

  return `/share/${encodeURIComponent(post.id)}?token=${encodeURIComponent(token)}`;
}

export function createPostShareUrl(post: ShareablePost, origin: string) {
  const path = createPostSharePath(post);
  if (!path) return null;

  return new URL(path, origin).toString();
}

export function getPublicSiteOrigin(req: Request) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl) return configuredSiteUrl.replace(/\/+$/, '');

  return new URL(req.url).origin;
}

export function serializePostWithShareUrl<T extends ShareablePost>(post: T, origin: string) {
  const shareUrl = createPostShareUrl(post, origin);
  if (!shareUrl) {
    throw new Error('Missing share signing secret');
  }

  return {
    ...post,
    createdAt: normalizeCreatedAt(post.createdAt),
    shareUrl,
  };
}
