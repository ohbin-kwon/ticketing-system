import { IsEmail, Length, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail({}, { message: '유효한 이메일 주소를 입력해주세요.' })
  email!: string;

  @Length(2, 20, { message: '닉네임은 2자 이상 20자 이하여야 합니다.' })
  nickname!: string;

  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  password!: string;
}
