import { User } from './user.entity.js';

export interface UserRepository {
  save(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  existsByEmail(email: string): Promise<boolean>;
}
