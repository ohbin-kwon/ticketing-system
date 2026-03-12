import { IsEmail, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: '유효한 이메일 주소를 입력해주세요.' })
  email!: string;

  @IsNotEmpty({ message: '비밀번호를 입력해주세요.' })
  password!: string;
}
