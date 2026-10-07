import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import pkg from '../package.json' with { type: 'json' };
import { AppModule } from './app.module.js';

const { name, version, description } = pkg;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors();

  app.use(
    '/docs',
    apiReference({
      content: SwaggerModule.createDocument(
        app,
        new DocumentBuilder()
          .setTitle(name)
          .setDescription(description)
          .setVersion(version)
          .addBearerAuth()
          .build(),
      ),
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
