import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

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
}
