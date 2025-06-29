import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { User } from '../../users/entities/user.entity'

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

  @ManyToOne(() => User, user => user.repos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @OneToMany(() => File, file => file.repo)
  files: File[]
}
