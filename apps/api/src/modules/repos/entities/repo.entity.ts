import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { User } from '../../user/entities/user.entity'

import { File } from './file.entity'

@Entity('repos')
export class Repo {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @Column({ default: '' })
  path: string

  @Column({ name: 'git_url' })
  gitUrl: string

  @Column({ name: 'access_key' })
  accessKey: string

  @Column({ name: 'clone_status', default: 'pending' })
  cloneStatus: string

  @CreateDateColumn({ name: 'indexed_at', type: 'timestamp' })
  indexedAt: Date

  @ManyToOne(() => User, user => user.repos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @OneToMany(() => File, file => file.repo)
  files: File[]
}
