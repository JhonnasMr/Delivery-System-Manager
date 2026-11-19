import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DriverHeader from '@/components/layout/driver-header'
import DriverBottomNav from '@/components/layout/driver-bottom-nav'

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20 max-w-lg mx-auto shadow-sm border-x border-gray-200 flex flex-col">
      <DriverHeader profile={profile} />
      <main className="flex-1 p-4">{children}</main>
      <DriverBottomNav />
    </div>
  )
}
