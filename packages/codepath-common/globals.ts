//ENUMS
export enum SegmentKinds {
  IMPORT = 'import',
  FUNCTION = 'function',
  CLASS = 'class',
  FILE = 'file'
}

export enum DepentencyTypes {
  IMPORT = 'import',
  EXTENDS = 'extends',
  CALLS = 'calls'
}

// TYPES
export type GenericNullable<T> = T | null

export type SegmentKind = `${SegmentKinds}`

export type DependencyType = `${DepentencyTypes}` 
