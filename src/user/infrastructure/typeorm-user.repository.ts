import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../domain/user.entity.js';
import { UserRepository } from '../domain/user.repository.js';
import { UserOrmEntity } from './user.typeorm.entity.js';
import { UserMapper } from './user.mapper.js';

@Injectable()
export class TypeormUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly ormRepository: Repository<UserOrmEntity>,
  ) {}

  async save(user: User): Promise<User> {
    const orm = UserMapper.toOrm(user);
    const saved = await this.ormRepository.save(orm);
    return UserMapper.toDomain(saved);
  }

  async findById(id: string): Promise<User | null> {
    const orm = await this.ormRepository.findOne({ where: { id } });
    return orm ? UserMapper.toDomain(orm) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const orm = await this.ormRepository.findOne({ where: { email } });
    return orm ? UserMapper.toDomain(orm) : null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.ormRepository.count({ where: { email } });
    return count > 0;
  }
}
