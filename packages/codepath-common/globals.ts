//ENUMS
export enum SegmentKinds {
  IMPORT = 'import',
  FUNCTION = 'function',
  CLASS = 'class',
  FILE = 'file',
  METHOD = 'method'
}

export enum DepentencyTypes {
  IMPORT = 'import',
  EXTENDS = 'extends',
  CALLS = 'calls'
}

// TYPES
export type Nullable<T> = T | null

export type Undefinable<T> = T | undefined

export type SegmentKind = `${SegmentKinds}`

export type DependencyType = `${DepentencyTypes}` 
