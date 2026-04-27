import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { fetchAllTweets, isXConfigured } from '../../lib/x/server';

export async function POST(request: Request) {
  // Optional secret-based auth guard
  const configuredSecret = process.env.REFRESH_SHARED_SECRET;
  if (configuredSecret) {
    const suppliedSecret = request.headers.get('x-refresh-secret');
    if (suppliedSecret !== configuredSecret) {
      return NextResponse.json(
        { ok: false, error: 'unauthorized' },
        { status: 401 }
      );
    }
  }

  if (!isXConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'X_BEARER_TOKEN not set in environment' },
      { status: 503 }
    );
  }

  try {
    const tweetsByAuthor = await fetchAllTweets();

    // Count tweets fetched per author for the response
    const counts = Object.fromEntries(
      Object.entries(tweetsByAuthor).map(([key, tweets]) => [key, tweets.length])
    );

    // Tell Next.js to purge the /feed RSC cache so the next
    // page visit will get the freshly fetched data
    revalidatePath('/feed');

    return NextResponse.json({
      ok: true,
      fetched: counts,
      refreshedAt: new Date().toLocaleString('en-AU', {
        timeZone: 'Australia/Brisbane',
      }) + ' AEST',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
