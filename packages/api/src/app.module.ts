import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from '@nestjs/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { VaultsModule } from './vaults/vaults.module.js';
import { AssetsModule } from './assets/assets.module.js';
import { WalletsModule } from './wallets/wallets.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { OperationsModule } from './operations/operations.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AuditModule } from './audit/audit.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DrizzleModule.forRoot({
      drizzle,
      connection: process.env.DATABASE_URL!,
    }),
    AuthModule,
    VaultsModule,
    AssetsModule,
    WalletsModule,
    InvitationsModule,
    OperationsModule,
    NotificationsModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
