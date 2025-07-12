import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { DependenciesController } from './dependencies.controller'
import { DependenciesService } from './dependencies.service'
import { Dependencies } from './entity/dependencies.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dependencies,
    ]),
  ],
  controllers: [DependenciesController],
  providers: [DependenciesService],
})
export class DependenciesModule {}
