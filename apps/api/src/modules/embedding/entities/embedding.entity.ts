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

  @Column()
  type: string

  @Column()
  content: string

  @Column()
  embedding: string
}
