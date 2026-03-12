import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SignupUseCase } from '../application/signup.use-case.js';
import type { SignupOutput } from '../application/signup.use-case.js';
import { LoginUseCase } from '../application/login.use-case.js';
import type { LoginOutput } from '../application/login.use-case.js';
import { SignupDto } from './dto/signup.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('users')
export class UserController {
  constructor(
    private readonly signupUseCase: SignupUseCase,
    private readonly loginUseCase: LoginUseCase,
  ) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDto): Promise<SignupOutput> {
    return this.signupUseCase.execute(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<LoginOutput> {
    return this.loginUseCase.execute(dto);
  }
}
