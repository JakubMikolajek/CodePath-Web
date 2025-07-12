'use client'

import mermaid from 'mermaid'
import { useEffect } from 'react'

interface MermaidGraphProps {
  graph: string
}

mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
  flowchart: {
    useMaxWidth: true,
  },
})

export default function MermaidGraph({ graph }: MermaidGraphProps) {
  if (graph === '') {
    return <p>Loading</p>
  }

  useEffect(() => {
    if (graph !== '') {
      mermaid.contentLoaded()
    }
  }, [graph])
  return (
    <div className="p-4 w-full h-full">
      <div className="mermaid">{graph}</div>
    </div>
  )
}
