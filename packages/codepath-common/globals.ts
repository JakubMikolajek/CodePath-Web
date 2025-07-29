// TYPES
export type GenericNullable<T> = T | null

export type SegmentKind = 'import' | 'function' | 'class' | 'file'

export type DependencyType = 'import' | 'extends' | 'calls'
