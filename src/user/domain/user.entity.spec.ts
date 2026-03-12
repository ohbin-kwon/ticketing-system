import { User } from './user.entity.js';
import { UserStatus } from './user-status.enum.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';

describe('User', () => {
  const validEmail = 'test@example.com';
  const validNickname = 'testuser';
  const hashedPassword = '$2a$10$hashedpassword';

  describe('create', () => {
    it('should create a user with valid inputs', () => {
      const user = User.create(validEmail, validNickname, hashedPassword);

      expect(user.id).toBeDefined();
      expect(user.email).toBe(validEmail);
      expect(user.nickname).toBe(validNickname);
      expect(user.password).toBe(hashedPassword);
      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should generate a UUID for id', () => {
      const user = User.create(validEmail, validNickname, hashedPassword);
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(user.id).toMatch(uuidRegex);
    });

    it('should throw DomainException for invalid email', () => {
      expect(() =>
        User.create('invalid-email', validNickname, hashedPassword),
      ).toThrow(DomainException);
      expect(() =>
        User.create('invalid-email', validNickname, hashedPassword),
      ).toThrow('유효하지 않은 이메일 형식입니다.');
    });

    it('should throw DomainException for nickname shorter than 2 characters', () => {
      expect(() => User.create(validEmail, 'a', hashedPassword)).toThrow(
        DomainException,
      );
      expect(() => User.create(validEmail, 'a', hashedPassword)).toThrow(
        '닉네임은 2자 이상 20자 이하여야 합니다.',
      );
    });

    it('should throw DomainException for nickname longer than 20 characters', () => {
      const longNickname = 'a'.repeat(21);
      expect(() =>
        User.create(validEmail, longNickname, hashedPassword),
      ).toThrow(DomainException);
    });

    it('should accept nickname with exactly 2 characters', () => {
      const user = User.create(validEmail, 'ab', hashedPassword);
      expect(user.nickname).toBe('ab');
    });

    it('should accept nickname with exactly 20 characters', () => {
      const nickname = 'a'.repeat(20);
      const user = User.create(validEmail, nickname, hashedPassword);
      expect(user.nickname).toBe(nickname);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a user from persisted data', () => {
      const id = crypto.randomUUID();
      const now = new Date();
      const user = User.reconstitute(
        id,
        validEmail,
        validNickname,
        hashedPassword,
        UserStatus.ACTIVE,
        now,
        now,
      );

      expect(user.id).toBe(id);
      expect(user.email).toBe(validEmail);
      expect(user.status).toBe(UserStatus.ACTIVE);
    });
  });

  describe('suspend', () => {
    it('should suspend an active user', () => {
      const user = User.create(validEmail, validNickname, hashedPassword);
      user.suspend();
      expect(user.status).toBe(UserStatus.SUSPENDED);
    });

    it('should throw DomainException when suspending a non-active user', () => {
      const user = User.create(validEmail, validNickname, hashedPassword);
      user.suspend();
      expect(() => user.suspend()).toThrow(DomainException);
      expect(() => user.suspend()).toThrow(
        '활성 상태의 사용자만 정지할 수 있습니다.',
      );
    });
  });

  describe('delete', () => {
    it('should delete an active user', () => {
      const user = User.create(validEmail, validNickname, hashedPassword);
      user.delete();
      expect(user.status).toBe(UserStatus.DELETED);
    });

    it('should delete a suspended user', () => {
      const user = User.create(validEmail, validNickname, hashedPassword);
      user.suspend();
      user.delete();
      expect(user.status).toBe(UserStatus.DELETED);
    });

    it('should throw DomainException when deleting an already deleted user', () => {
      const user = User.create(validEmail, validNickname, hashedPassword);
      user.delete();
      expect(() => user.delete()).toThrow(DomainException);
      expect(() => user.delete()).toThrow('이미 삭제된 사용자입니다.');
    });
  });

  describe('isActive', () => {
    it('should return true for active user', () => {
      const user = User.create(validEmail, validNickname, hashedPassword);
      expect(user.isActive()).toBe(true);
    });

    it('should return false for suspended user', () => {
      const user = User.create(validEmail, validNickname, hashedPassword);
      user.suspend();
      expect(user.isActive()).toBe(false);
    });

    it('should return false for deleted user', () => {
      const user = User.create(validEmail, validNickname, hashedPassword);
      user.delete();
      expect(user.isActive()).toBe(false);
    });
  });
});
