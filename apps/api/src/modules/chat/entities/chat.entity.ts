import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { User } from '../../users/entities/user.entity'

@Entity()
export class Chat {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'session_id' })
  sessionId: string

  @Column()
  question: string

  @Column()
  response: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @Column({ name: 'user_id' })
  userId: number

  @ManyToOne(() => User, user => user.chatHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User
}
