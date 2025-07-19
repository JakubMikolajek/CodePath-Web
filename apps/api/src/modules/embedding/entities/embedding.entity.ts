import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'

import { File } from '../../repos/entities/file.entity'

@Entity('embeddings')
export class Embedding {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'file_id' })
  fileId: number

  @ManyToOne(() => File, file => file.embeddings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_id' })
  file: File

  @Column({ name: 'symbol_kind' })
  symbolKind: string

  @Column({ name: 'symbol_name', nullable: true })
  symbolName?: string

  @Column()
  content: string

  @Column()
  embedding: string

  @Column({ nullable: true })
  comment?: string

  @Column({ name: 'js_doc', nullable: true })
  jsDoc?: string

  @Column({ type: 'simple-array', nullable: true })
  decorators?: string[]

  @Column({ type: 'simple-array', nullable: true })
  params?: string[]

  @Column({ name: 'return_type', nullable: true })
  returnType?: string

  @Column({ name: 'start_line', nullable: true })
  startLine?: number

  @Column({ name: 'end_line', nullable: true })
  endLine?: number
}
