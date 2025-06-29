import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm'

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

  @Column()
  path: string

  @Column({ name: 'last_modified', type: 'timestamp', nullable: true })
  lastModified: Date

  @Column()
  hash: string
}
