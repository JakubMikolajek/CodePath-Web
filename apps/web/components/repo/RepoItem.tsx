import { Button } from '@workspace/ui/components/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@workspace/ui/components/collapsible'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@workspace/ui/components/sidebar'
import { ChevronRight, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import PopoverWrapper from '@/components/PopoverWrapper'
import { Repo } from '@/interfaces/repo'
import { useEmbeddingStore } from '@/store'

interface RepoItemProps {
  item: Repo
}

export default function RepoItem({ item }: RepoItemProps) {
  const [toEmbedding, setToEmbedding] = useState<boolean>(false)

  const { shouldBeEmbedded, runEmbedding } = useEmbeddingStore()

  const checkEmbedding = async () => setToEmbedding(await shouldBeEmbedded(item.id))

  const handleEmbedding = async () => await runEmbedding(item.id)

  useEffect(() => {
    checkEmbedding()
  }, [])

  return (
    <Collapsible
      key={item.id}
      asChild
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.name}>
            <div className="flex flex-row gap-1 items-center">
              <span>{item.name}</span>
              {toEmbedding && <PopoverWrapper asChild trigger={<TriangleAlert color="orange" />}>
                <div className="flex flex-col justify-center items-center gap-2">
                  <p>Embedding required</p>
                  <Button onClick={handleEmbedding} variant="outline">Embed</Button>
                </div>
              </PopoverWrapper>}
            </div>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton asChild>
                <Link href={`/${item.id}/chat`}>
                  <span>Chat</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>

            <SidebarMenuSubItem>
              <SidebarMenuSubButton asChild>
                <Link href={`/${item.id}/api`}>
                  <span>Api</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>

            <SidebarMenuSubItem>
              <SidebarMenuSubButton asChild>
                <Link href={`/${item.id}/docs`}>
                  <span>Docs</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
