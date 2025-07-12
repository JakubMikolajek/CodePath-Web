'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'

import MermaidGraph from '@/components/MermaidGraph'
import { useDependenciesStore } from '@/store'

export default function Page() {
  const params = useParams()

  const { getDependencies, graph } = useDependenciesStore()

  useEffect(() => {
    getDependencies(Number(params.repoId as string))
  }, [params.repoId])



  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Graph</h1>
        <MermaidGraph graph={graph} />
      </div>
    </div>
  )
}
