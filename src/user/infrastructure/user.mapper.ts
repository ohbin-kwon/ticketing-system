import { User } from '../domain/user.entity.js';
import { UserStatus } from '../domain/user-status.enum.js';
import { UserOrmEntity } from './user.typeorm.entity.js';

export class UserMapper {
  static toDomain(orm: UserOrmEntity): User {
    return User.reconstitute(
      orm.id,
      orm.email,
      orm.nickname,
      orm.password,
      orm.status as UserStatus,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  static toOrm(domain: User): UserOrmEntity {
    const orm = new UserOrmEntity();
    orm.id = domain.id;
    orm.email = domain.email;
    orm.nickname = domain.nickname;
    orm.password = domain.password;
    orm.status = domain.status;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
