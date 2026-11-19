'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDateLong } from '@/lib/utils/date'
import { Bike, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import type { Profile } from '@/types/database'

interface DriverHeaderProps {
  profile: Profile
}

export default function DriverHeader({ profile }: DriverHeaderProps) {
  const router = useRouter()
  const firstName = profile.full_name.split(' ')[0]

  const handleSignOut = async () => {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('No se pudo cerrar sesión')
      return
    }
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="bg-blue-600 text-white px-4 py-4 shadow-md sticky top-0 z-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <Bike className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">
              Hola, {firstName}
            </h1>
            <p className="text-xs text-blue-100 capitalize">
              {formatDateLong(new Date())}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
