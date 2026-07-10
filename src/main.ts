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
  // CORS_ORIGIN aceita múltiplas origens separadas por vírgula (ex.: apex + www).
  const corsOrigins = config
    .get<string>('CORS_ORIGIN', 'http://localhost:3100')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  })

  const port = config.get<number>('PORT', 3001)
  await app.listen(port)
  console.log(`ReveLar backend rodando em http://localhost:${port}`)
}
bootstrap()
