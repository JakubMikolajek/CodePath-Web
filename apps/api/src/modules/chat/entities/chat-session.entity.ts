import { Entity, Column, PrimaryColumn } from 'typeorm'

@Entity('chat_sessions')
export class ChatSession {
  @PrimaryColumn()
  id: string

  @Column()
  user_id: number

  @Column({ nullable: true })
  name: string

  @Column({ type: 'timestamp', default: () => 'now()' })
  created_at: Date
}
