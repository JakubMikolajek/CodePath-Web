'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import MermaidGraph from '@/components/MermaidGraph'
import { DependencyEdge } from '@/interfaces/dependencies'
import { GenericNullable } from '@/interfaces/globals'
import { useDependenciesStore } from '@/store'

export default function Page() {
  const params = useParams()
  const [activeGraph, setActiveGraph] = useState<GenericNullable<DependencyEdge>>(null)

  const { graphs } = useDependenciesStore()

  useEffect(() => {
    setActiveGraph(graphs.find((graph) => graph.id === Number(params.graphId)) ?? null)
  }, [params])

  return (
    <div className="w-full relative bg-background">
      <div className="flex flex-col">
        <h1 className="text-2xl font-semibold text-foreground">Graph</h1>
        {activeGraph && <MermaidGraph key={activeGraph.id} graph={activeGraph.graph} />}
      </div>
    </div>
  )
}
