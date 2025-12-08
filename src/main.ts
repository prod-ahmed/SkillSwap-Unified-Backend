import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import * as express from 'express';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Increase body limit for base64 images
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // Enable CORS
    app.enableCors();

    // Enable global validation
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: false,
            transform: true,
        }),
    );

    // Serve static files
    app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

    // Swagger configuration
    const config = new DocumentBuilder()
        .setTitle('SkillSwap Unified API')
        .setDescription('Unified API for SkillSwap App')
        .setVersion('1.0')
        .addBearerAuth(
            { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            'access-token',
        )
        .build();

    const document = SwaggerModule.createDocument(app, config);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (document as any).security = [{ 'access-token': [] }];

    SwaggerModule.setup('api', app, document, {
        swaggerOptions: {
            persistAuthorization: true,
        },
    });

    await app.listen(3000, '0.0.0.0');
    console.log('🚀 Unified Server running on http://localhost:3000');
    console.log('📘 Swagger docs available on http://localhost:3000/api');
}
bootstrap();
