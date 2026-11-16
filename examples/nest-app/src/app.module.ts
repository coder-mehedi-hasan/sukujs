import { Module } from '@nestjs/common';
import { ProductController, UserController } from './app.controller';
import { CounterService } from './app.service';

@Module({
  imports: [],
  controllers: [UserController, ProductController],
  providers: [CounterService],
})
export class AppModule {}
