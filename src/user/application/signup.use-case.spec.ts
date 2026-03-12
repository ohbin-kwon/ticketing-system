import * as bcrypt from 'bcryptjs';
import { SignupUseCase } from './signup.use-case.js';
import { UserRepository } from '../domain/user.repository.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { User } from '../domain/user.entity.js';

jest.mock('bcryptjs');

describe('SignupUseCase', () => {
  let useCase: SignupUseCase;
  let userRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    userRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      existsByEmail: jest.fn(),
    };
    useCase = new SignupUseCase(userRepository);
  });

  const input = {
    email: 'test@example.com',
    nickname: 'testuser',
    password: 'password123',
  };

  it('should sign up a new user successfully', async () => {
    userRepository.existsByEmail.mockResolvedValue(false);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    userRepository.save.mockImplementation((user: User) =>
      Promise.resolve(user),
    );

    const result = await useCase.execute(input);

    expect(result.email).toBe(input.email);
    expect(result.nickname).toBe(input.nickname);
    expect(result.id).toBeDefined();
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(userRepository.existsByEmail).toHaveBeenCalledWith(input.email);
    expect(bcrypt.hash).toHaveBeenCalledWith(input.password, 10);
    expect(userRepository.save).toHaveBeenCalled();
    /* eslint-enable @typescript-eslint/unbound-method */
  });

  it('should throw USER_EMAIL_DUPLICATE when email already exists', async () => {
    userRepository.existsByEmail.mockResolvedValue(true);

    await expect(useCase.execute(input)).rejects.toThrow(DomainException);
    await expect(useCase.execute(input)).rejects.toThrow(
      '이미 사용 중인 이메일입니다.',
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('should hash the password with salt rounds 10', async () => {
    userRepository.existsByEmail.mockResolvedValue(false);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    userRepository.save.mockImplementation((user: User) =>
      Promise.resolve(user),
    );

    await useCase.execute(input);

    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
  });
});
