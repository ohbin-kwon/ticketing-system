import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { UserOrmEntity } from './infrastructure/user.typeorm.entity.js';
import { TypeormUserRepository } from './infrastructure/typeorm-user.repository.js';
import { JwtStrategy } from './infrastructure/jwt.strategy.js';
import { JwtAuthGuard } from './infrastructure/jwt-auth.guard.js';
import { SignupUseCase } from './application/signup.use-case.js';
import { LoginUseCase } from './application/login.use-case.js';
import { UserController } from './presentation/user.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserOrmEntity]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'default-secret'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN', '1h'),
        },
      }),
    }),
  ],
  controllers: [UserController],
  providers: [
    SignupUseCase,
    LoginUseCase,
    JwtStrategy,
    JwtAuthGuard,
    {
      provide: 'UserRepository',
      useClass: TypeormUserRepository,
    },
  ],
  exports: [JwtAuthGuard, JwtStrategy, PassportModule, JwtModule],
})
export class UserModule {}
