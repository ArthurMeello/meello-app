// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { userIds } = await req.json()
  if (!userIds?.length) return NextResponse.json({ data: [] })

  const supabase = createAdminClient()
  const results = await Promise.all(
    userIds.map(async (id: string) => {
      const { data } = await supabase.auth.admin.getUserById(id)
      return { id, is_confirmed: !!data?.user?.email_confirmed_at }
    })
  )
  return NextResponse.json({ data: results })
}
