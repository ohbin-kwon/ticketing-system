import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { LoginUseCase } from './login.use-case.js';
import { UserRepository } from '../domain/user.repository.js';
import { User } from '../domain/user.entity.js';
import { UserStatus } from '../domain/user-status.enum.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';

jest.mock('bcryptjs');

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let userRepository: jest.Mocked<UserRepository>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(() => {
    userRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      existsByEmail: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('jwt-token'),
    } as unknown as jest.Mocked<JwtService>;
    useCase = new LoginUseCase(userRepository, jwtService);
  });

  const input = { email: 'test@example.com', password: 'password123' };

  const activeUser = User.reconstitute(
    'user-id',
    'test@example.com',
    'testuser',
    'hashed-password',
    UserStatus.ACTIVE,
    new Date(),
    new Date(),
  );

  it('should login successfully and return access token', async () => {
    userRepository.findByEmail.mockResolvedValue(activeUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await useCase.execute(input);

    expect(result.accessToken).toBe('jwt-token');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'user-id',
      email: 'test@example.com',
    });
  });

  it('should throw USER_NOT_FOUND when user does not exist', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toThrow(DomainException);
    await expect(useCase.execute(input)).rejects.toThrow(
      '사용자를 찾을 수 없습니다.',
    );
  });

  it('should throw USER_INVALID_PASSWORD when password is wrong', async () => {
    userRepository.findByEmail.mockResolvedValue(activeUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(useCase.execute(input)).rejects.toThrow(DomainException);
    await expect(useCase.execute(input)).rejects.toThrow(
      '비밀번호가 일치하지 않습니다.',
    );
  });

  it('should throw USER_NOT_ACTIVE when user is suspended', async () => {
    const suspendedUser = User.reconstitute(
      'user-id',
      'test@example.com',
      'testuser',
      'hashed-password',
      UserStatus.SUSPENDED,
      new Date(),
      new Date(),
    );
    userRepository.findByEmail.mockResolvedValue(suspendedUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(useCase.execute(input)).rejects.toThrow(DomainException);
    await expect(useCase.execute(input)).rejects.toThrow(
      '활성 상태가 아닌 사용자입니다.',
    );
  });
});
