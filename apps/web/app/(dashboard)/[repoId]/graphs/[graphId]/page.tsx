'use client'

import type { GenericNullable } from '@workspace/codepath-common/globals'
import type { Graph } from '@workspace/codepath-common/graph'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import MermaidGraph from '@/components/MermaidGraph'
import { useAppSelector } from '@/redux/hooks'

export default function Page() {
  const params = useParams()
  const [activeGraph, setActiveGraph] = useState<GenericNullable<Graph>>(null)

  const graphs = useAppSelector(state => state.graphs.graphs)

  useEffect(() => {
    setActiveGraph(graphs.find(graph => graph.id === Number(params.graphId)) ?? null)
  }, [params])

  return (
    <div className="w-full relative bg-background">
      <div className="flex flex-col">
        <h1 className="text-2xl font-semibold text-foreground">Graph</h1>
        {activeGraph && <MermaidGraph graph={activeGraph.graph} key={activeGraph.id} />}
      </div>
    </div>
  )
}
