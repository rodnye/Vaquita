import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users, type User } from '../db/schema.js';

@Injectable()
export class UsersService {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async create(data: {
    username: string;
    email: string;
    passwordHash: string;
  }): Promise<User> {
    const [user] = await this.db.insert(users).values(data).returning();
    return user;
  }

  async findById(id: number): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async findByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async findByUsernameOrEmail(
    username: string,
    email: string,
  ): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(or(eq(users.username, username), eq(users.email, email)));
    return user;
  }

  async getByIdOrThrow(id: number): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }
}
