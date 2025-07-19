import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { DocsSegment } from '../../docs/entity/docs-segments.entity'
import { Embedding } from '../../embedding/entities/embedding.entity'

import { Repo } from './repo.entity'

@Entity('files')
export class File {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'repo_id' })
  repoId: number

  @ManyToOne(() => Repo, repo => repo.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repo_id' })
  repo: Repo

  @OneToMany(() => Embedding, embedding => embedding.file)
  embeddings: Embedding[]

  @OneToMany(() => DocsSegment, segment => segment.file)
  docsSegments: DocsSegment[]

  @Column()
  path: string

  @Column({ name: 'last_modified', type: 'timestamp', nullable: true })
  lastModified: Date

  @Column()
  hash: string
}
