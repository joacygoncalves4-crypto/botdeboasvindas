import { NextResponse } from 'next/server'
import { processDispatchQueue } from '@/lib/queue'

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processDispatchQueue()
    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    console.error('Queue processing error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Also allow POST for Vercel cron
export const POST = GET
