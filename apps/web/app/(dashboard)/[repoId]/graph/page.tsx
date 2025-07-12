'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'

import MermaidGraph from '@/components/MermaidGraph'
import { useDependenciesStore } from '@/store'

export default function Page() {
  const params = useParams()

  const { getDependencies, graphs } = useDependenciesStore()

  useEffect(() => {
    getDependencies(Number(params.repoId as string))
  }, [params.repoId])



  return (
    <div className="w-full relative bg-background">
      <div className="flex flex-col">
        <h1 className="text-2xl font-semibold text-foreground">Graph</h1>
        {graphs.map((graph) => <MermaidGraph key={graph.fileId} graph={graph.graph} />)}
      </div>
    </div>
  )
}
