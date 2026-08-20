import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { Response } from 'express';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const REFRESH_COOKIE = 'refresh_token';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto, response: Response) {
    const existing = await this.usersService.findByEmail(dto.email);

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create(dto.email, passwordHash);

    return this.buildAuthResponse(user, response);
  }

  async login(dto: LoginDto, response: Response) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user, response);
  }

  async refresh(userId: string, refreshToken: string, response: Response) {
    const user = await this.usersService.findById(userId);

    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);

    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.buildAuthResponse(user, response);
  }

  async logout(userId: string, response: Response): Promise<void> {
    await this.usersService.updateRefreshTokenHash(userId, null);
    this.clearRefreshCookie(response);
  }

  private async buildAuthResponse(user: User, response: Response) {
    const payload = { sub: user.id, email: user.email };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN') ?? '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    });

    // Store only a hash so a leaked database row cannot be used as a refresh token.
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshTokenHash(user.id, refreshTokenHash);
    this.setRefreshCookie(response, refreshToken);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  private setRefreshCookie(response: Response, refreshToken: string) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const refreshExpires =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    response.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/auth',
      maxAge: this.durationToMs(refreshExpires),
    });
  }

  private clearRefreshCookie(response: Response) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    response.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/auth',
    });
  }

  private durationToMs(value: string): number {
    const amount = Number.parseInt(value, 10);
    if (value.endsWith('d')) return amount * 86_400_000;
    if (value.endsWith('h')) return amount * 3_600_000;
    if (value.endsWith('m')) return amount * 60_000;
    return amount * 1000;
  }
}
