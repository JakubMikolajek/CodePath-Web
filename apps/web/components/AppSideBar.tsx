'use client'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@workspace/ui/components/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@workspace/ui/components/sidebar'
import {
  ChevronRight,
  BookOpen,
  Bot,
  Settings2,
} from 'lucide-react'
import React, { ComponentProps, useEffect } from 'react'


import UserDropdownMenu from '@/components/UserDropdownMenu'
import { useReposStore } from '@/store'


const items =    [{
  title: 'Models',
  url: '#',
  icon: Bot,
  items: [
    {
      title: 'Genesis',
      url: '#',
    },
    {
      title: 'Explorer',
      url: '#',
    },
    {
      title: 'Quantum',
      url: '#',
    },
  ],
},
{
  title: 'Documentation',
  url: '#',
  icon: BookOpen,
  items: [
    {
      title: 'Introduction',
      url: '#',
    },
    {
      title: 'Get Started',
      url: '#',
    },
    {
      title: 'Tutorials',
      url: '#',
    },
    {
      title: 'Changelog',
      url: '#',
    },
  ],
},
{
  title: 'Settings',
  url: '#',
  icon: Settings2,
  items: [
    {
      title: 'General',
      url: '#',
    },
    {
      title: 'Team',
      url: '#',
    },
    {
      title: 'Billing',
      url: '#',
    },
    {
      title: 'Limits',
      url: '#',
    },
  ],
},
]

export default function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const { repos, getRepos, loading } = useReposStore()

  useEffect(() => {
    getRepos()
  }, [])

  useEffect(() => {
    console.log(repos)
  }, [repos])

  return (
    <Sidebar variant="sidebar" {...props}>
      <SidebarHeader className="h-16 border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-4 justify-center h-full">
          <div className="text-left text-sm leading-tight">
            <span className="truncate font-semibold">CodePath</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Repositories</SidebarGroupLabel>
          <SidebarMenu>
            {repos.map((item) => (
              <Collapsible
                key={item.id}
                asChild
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={item.name}>
                      <span>{item.name}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <a>
                            <span>Chat</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>

                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <a>
                            <span>Api</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>

                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <a>
                            <span>Docs</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="h-16 border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <UserDropdownMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
