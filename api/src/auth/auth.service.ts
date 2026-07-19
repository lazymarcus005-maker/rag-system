import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { LessThan, Repository } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string };
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  private sweepTimer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const email = this.config.get('ADMIN_EMAIL', 'admin@local');
    const existing = await this.users.findOneBy({ email });
    if (!existing) {
      const password = this.config.get('ADMIN_PASSWORD', 'admin1234');
      await this.users.save(
        this.users.create({
          email,
          passwordHash: await bcrypt.hash(password, 10),
          role: 'admin',
        }),
      );
      this.logger.log(`Seeded admin user: ${email}`);
    }
    await this.sweepExpiredRefreshTokens();
    this.sweepTimer = setInterval(
      () => void this.sweepExpiredRefreshTokens(),
      REFRESH_SWEEP_INTERVAL_MS,
    );
    this.sweepTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  private async sweepExpiredRefreshTokens() {
    try {
      const { affected } = await this.refreshTokens.delete({
        expiresAt: LessThan(new Date()),
      });
      if (affected) this.logger.debug(`Swept ${affected} expired refresh tokens`);
    } catch (err) {
      this.logger.warn(`Refresh-token sweep failed: ${err}`);
    }
  }

  async register(email: string, password: string): Promise<AuthResult> {
    const existing = await this.users.findOneBy({ email });
    if (existing) throw new ConflictException('Email already registered');
    const user = await this.users.save(
      this.users.create({
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'user',
      }),
    );
    return this.issueTokens(user);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.users.findOneBy({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens(user);
  }

  async refresh(token: string | undefined): Promise<AuthResult> {
    if (!token) throw new UnauthorizedException('Missing refresh token');
    const row = await this.refreshTokens.findOneBy({ tokenHash: sha256(token) });
    if (!row || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    // rotation: refresh token ใช้ได้ครั้งเดียว
    await this.refreshTokens.delete(row.id);
    const user = await this.users.findOneBy({ id: row.userId });
    if (!user) throw new UnauthorizedException('User no longer exists');
    return this.issueTokens(user);
  }

  async logout(token: string | undefined) {
    if (token) {
      await this.refreshTokens.delete({ tokenHash: sha256(token) });
    }
    return { ok: true };
  }

  private async issueTokens(user: User): Promise<AuthResult> {
    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = randomBytes(48).toString('hex');
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      }),
    );
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}
