import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { User } from '../../user/entities/user.entity'

@Entity('chat_history')
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

  @ManyToOne(() => User, user => user.chats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User
}
