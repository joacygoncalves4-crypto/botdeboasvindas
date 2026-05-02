import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase()
  const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi']
  if (!ext || !allowed.includes(ext)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
  }

  const fileName = `followup-${Date.now()}.${ext}`
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const { data, error } = await supabaseAdmin.storage
    .from('followup-media')
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: urlData } = supabaseAdmin.storage
    .from('followup-media')
    .getPublicUrl(data.path)

  return NextResponse.json({ url: urlData.publicUrl })
}
