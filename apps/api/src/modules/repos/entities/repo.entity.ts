import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm'

import { File } from './file.entity'

@Entity('repos')
export class Repo {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @Column()
  path: string

  @CreateDateColumn({ name: 'indexed_at' })
  indexedAt: Date

  @OneToMany(() => File, file => file.repo)
  files: File[]
}
