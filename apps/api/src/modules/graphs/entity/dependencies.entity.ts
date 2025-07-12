import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('dependencies')
export class Dependencies {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'file_id' })
  fileId: number

  @Column({ name: 'repo_id' })
  repoId: number

  @Column({ name: 'from_symbol' })
  fromSymbol: string

  @Column({ name: 'to_symbol' })
  toSymbol: string

  @Column()
  type: string

  @Column({ name: 'imported_from', nullable: true })
  importedFrom: string

  @Column({ type: 'timestamp', default: () => 'now()' })
  created_at: Date
}
