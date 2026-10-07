import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

@Injectable()
export class AppService {
  constructor(
    @InjectDrizzle()
    private readonly db: NodePgDatabase,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }
}
