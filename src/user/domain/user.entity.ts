import { DomainException } from '../../common/exceptions/domain.exception.js';
import { UserStatus } from './user-status.enum.js';

export class User {
  private constructor(
    private readonly _id: string,
    private readonly _email: string,
    private readonly _nickname: string,
    private readonly _password: string,
    private _status: UserStatus,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(email: string, nickname: string, hashedPassword: string): User {
    User.validateEmail(email);
    User.validateNickname(nickname);

    const now = new Date();
    return new User(
      crypto.randomUUID(),
      email,
      nickname,
      hashedPassword,
      UserStatus.ACTIVE,
      now,
      now,
    );
  }

  static reconstitute(
    id: string,
    email: string,
    nickname: string,
    password: string,
    status: UserStatus,
    createdAt: Date,
    updatedAt: Date,
  ): User {
    return new User(
      id,
      email,
      nickname,
      password,
      status,
      createdAt,
      updatedAt,
    );
  }

  private static validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new DomainException(
        'USER_INVALID_EMAIL',
        '유효하지 않은 이메일 형식입니다.',
      );
    }
  }

  private static validateNickname(nickname: string): void {
    if (nickname.length < 2 || nickname.length > 20) {
      throw new DomainException(
        'USER_INVALID_NICKNAME',
        '닉네임은 2자 이상 20자 이하여야 합니다.',
      );
    }
  }

  suspend(): void {
    if (this._status !== UserStatus.ACTIVE) {
      throw new DomainException(
        'USER_NOT_ACTIVE',
        '활성 상태의 사용자만 정지할 수 있습니다.',
      );
    }
    this._status = UserStatus.SUSPENDED;
    this._updatedAt = new Date();
  }

  delete(): void {
    if (this._status === UserStatus.DELETED) {
      throw new DomainException(
        'USER_ALREADY_DELETED',
        '이미 삭제된 사용자입니다.',
      );
    }
    this._status = UserStatus.DELETED;
    this._updatedAt = new Date();
  }

  isActive(): boolean {
    return this._status === UserStatus.ACTIVE;
  }

  get id(): string {
    return this._id;
  }

  get email(): string {
    return this._email;
  }

  get nickname(): string {
    return this._nickname;
  }

  get password(): string {
    return this._password;
  }

  get status(): UserStatus {
    return this._status;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
