import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('embeddings')
export class Embedding {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'file_id' })
  fileId: number

  @Column()
  type: string

  @Column()
  content: string

  @Column()
  embedding: string
}
