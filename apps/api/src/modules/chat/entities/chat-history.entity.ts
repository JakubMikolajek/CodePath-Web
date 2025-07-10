import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

@Entity('chat_history')
export class ChatHistory {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  user_id: number

  @Column()
  session_id: string

  @Column()
  role: 'user' | 'assistant'

  @Column()
  content: string

  @Column({ type: 'timestamp', default: () => 'now()' })
  created_at: Date
}
