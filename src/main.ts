import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)

  app.use(cookieParser())
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  )

  // CORS com credenciais para o frontend Nuxt enviar/receber o cookie de sessão.
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3100'),
    credentials: true,
  })

  const port = config.get<number>('PORT', 3001)
  await app.listen(port)
  console.log(`Meu Revelar backend rodando em http://localhost:${port}`)
}
bootstrap()
