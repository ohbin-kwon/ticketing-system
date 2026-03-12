import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { User } from '../domain/user.entity.js';
import type { UserRepository } from '../domain/user.repository.js';

export interface SignupInput {
  email: string;
  nickname: string;
  password: string;
}

export interface SignupOutput {
  id: string;
  email: string;
  nickname: string;
}

@Injectable()
export class SignupUseCase {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: SignupInput): Promise<SignupOutput> {
    const emailExists = await this.userRepository.existsByEmail(input.email);
    if (emailExists) {
      throw new DomainException(
        'USER_EMAIL_DUPLICATE',
        '이미 사용 중인 이메일입니다.',
      );
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);
    const user = User.create(input.email, input.nickname, hashedPassword);
    const saved = await this.userRepository.save(user);

    return {
      id: saved.id,
      email: saved.email,
      nickname: saved.nickname,
    };
  }
}
