import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { File } from '../../repos/entities/file.entity'

@Entity('docs_segments')
export class DocsSegment {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'file_id' })
  fileId: number

  @ManyToOne(() => File, file => file.docsSegments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_id' })
  file: File

  @Column()
  kind: string

  @Column({ nullable: true })
  name?: string

  @Column({ type: 'text' })
  content: string

  @Column({ type: 'text', nullable: true })
  comment?: string

  @Column({ type: 'text', nullable: true, name: 'js_doc' })
  jsDoc?: string

  @Column({ type: 'text', array: true, nullable: true })
  decorators?: string[]

  @Column({ type: 'text', array: true, nullable: true })
  params?: string[]

  @Column({ name: 'return_type', nullable: true })
  returnType?: string

  @Column({ name: 'start_line', type: 'int', nullable: true })
  startLine?: number

  @Column({ name: 'end_line', type: 'int', nullable: true })
  endLine?: number

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
