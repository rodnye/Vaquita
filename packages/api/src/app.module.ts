import { Module } from '@nestjs/common';
import { DrizzleModule } from '@nestjs/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [
    DrizzleModule.forRoot({
      drizzle,
      connection: process.env.DATABASE_URL!,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
