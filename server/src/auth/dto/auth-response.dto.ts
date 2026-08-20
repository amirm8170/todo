import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ example: '3b0d1a2e-8c4f-4c3a-9f1b-2a6d8e0c1111' })
  id: string;

  @ApiProperty({ example: 'you@example.com' })
  email: string;
}

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Short-lived JWT. Send as Authorization: Bearer <token>.',
  })
  accessToken: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}
