import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('dependencies')
export class Dependencies {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'file_id' })
  fileId: number

  @Column({ name: 'repo_id' })
  repoId: number

  @Column({ name: 'file_name' })
  fileName: string

  @Column()
  graph: string

  @Column({ type: 'timestamp', default: () => 'now()' })
  created_at: Date
}
