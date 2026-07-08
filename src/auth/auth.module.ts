import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { UsersModule } from '../users/users.module'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtAuthGuard } from './jwt-auth.guard'

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        // `ms` tipa expiresIn como template literal; o valor vem do .env como string.
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') as `${number}d` },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  // JwtModule + guard exportados para outros módulos protegerem rotas (ex.: OpportunitiesModule).
  exports: [AuthService, JwtModule, JwtAuthGuard],
})
export class AuthModule {}
