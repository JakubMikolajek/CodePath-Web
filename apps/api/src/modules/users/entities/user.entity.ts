import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm'

import { Chat } from '../../chat/entities/chat.entity'
import { Repo } from '../../repos/entities/repo.entity'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ unique: true })
  email: string

  @Column({ name: 'password_hash' })
  passwordHash: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @OneToMany(() => Repo, repo => repo.user)
  repos: Repo[]

  @OneToMany(() => Chat, chat => chat.user)
  chatHistory: Chat[]
}
