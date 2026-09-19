import type { DashboardRecentChat } from '@/lib/dashboard'
import { formatRelativeTime } from '@/lib/dashboard-utils'

interface RecentChatsProps {
  chats: DashboardRecentChat[]
}

export function RecentChats({ chats }: RecentChatsProps) {
  return (
    <aside aria-labelledby="recent-chats-title" className="nurt-panel p-[18px_20px]">
      <h2 className="mb-3.5 text-[15px] font-semibold text-foreground" id="recent-chats-title">Recent chats</h2>

      {chats.length === 0 ? (
        <p className="py-5 text-center text-[12.5px] text-(--nurt-t3)">No chats yet</p>
      ) : (
        <div>
          {chats.map((chat, index) => (
            <div className={index === 0 ? 'py-2.5' : 'border-t border-white/6 py-2.5'} key={chat.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-[12.5px] text-foreground">{chat.name ?? `Session for repo ${chat.repoId}`}</p>

                <span className="shrink-0 text-[11px] text-(--nurt-t3)">{formatRelativeTime(chat.lastMessageAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
