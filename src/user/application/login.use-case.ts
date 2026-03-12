import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import type { UserRepository } from '../domain/user.repository.js';
import type { JwtPayload } from '../infrastructure/jwt-payload.interface.js';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginOutput {
  accessToken: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.userRepository.findByEmail(input.email);
    if (!user) {
      throw new DomainException('USER_NOT_FOUND', '사용자를 찾을 수 없습니다.');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      throw new DomainException(
        'USER_INVALID_PASSWORD',
        '비밀번호가 일치하지 않습니다.',
      );
    }

    if (!user.isActive()) {
      throw new DomainException(
        'USER_NOT_ACTIVE',
        '활성 상태가 아닌 사용자입니다.',
      );
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }
}
