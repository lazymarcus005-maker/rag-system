import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

function makeService() {
  const usersStore = new Map<string, any>();
  const tokensStore = new Map<string, any>();

  const users = {
    findOneBy: jest.fn(async (where: any) => {
      if (where.email) {
        for (const u of usersStore.values()) if (u.email === where.email) return u;
        return null;
      }
      return usersStore.get(where.id) ?? null;
    }),
    create: jest.fn((data: any) => ({ id: `u-${usersStore.size + 1}`, ...data })),
    save: jest.fn(async (u: any) => {
      usersStore.set(u.id, u);
      return u;
    }),
  };

  const refreshTokens = {
    findOneBy: jest.fn(async (where: any) => tokensStore.get(where.tokenHash) ?? null),
    create: jest.fn((data: any) => ({ id: `t-${tokensStore.size + 1}`, ...data })),
    save: jest.fn(async (t: any) => {
      tokensStore.set(t.tokenHash, t);
      return t;
    }),
    delete: jest.fn(async (arg: any) => {
      if (typeof arg === 'string') {
        for (const [k, v] of tokensStore) if (v.id === arg) tokensStore.delete(k);
      } else if (arg.tokenHash) {
        tokensStore.delete(arg.tokenHash);
      } else if (arg.expiresAt) {
        for (const [k, v] of tokensStore) if (v.expiresAt < new Date()) tokensStore.delete(k);
      }
      return { affected: 1 };
    }),
  };

  const jwt = { sign: jest.fn(() => 'access.jwt.token') };
  const config = { get: jest.fn((_k: string, d?: any) => d) };

  const service = new AuthService(
    users as any,
    refreshTokens as any,
    jwt as any,
    config as any,
  );
  return { service, usersStore, tokensStore, users, refreshTokens, jwt };
}

describe('AuthService', () => {
  it('registers a new user and returns tokens', async () => {
    const { service, usersStore } = makeService();
    const result = await service.register('a@b.co', 'password1');
    expect(result.user.email).toBe('a@b.co');
    expect(result.user.role).toBe('user');
    expect(result.accessToken).toBe('access.jwt.token');
    expect(result.refreshToken).toMatch(/^[0-9a-f]{96}$/);
    expect(usersStore.size).toBe(1);
  });

  it('rejects duplicate email registration', async () => {
    const { service } = makeService();
    await service.register('a@b.co', 'password1');
    await expect(service.register('a@b.co', 'password1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('logs in with valid credentials', async () => {
    const { service, users, usersStore } = makeService();
    const user = {
      id: 'u1',
      email: 'a@b.co',
      role: 'user',
      passwordHash: await bcrypt.hash('password1', 4),
    };
    usersStore.set('u1', user);
    users.findOneBy.mockImplementation(async (w: any) =>
      w.email === 'a@b.co' ? user : null,
    );
    const result = await service.login('a@b.co', 'password1');
    expect(result.user.id).toBe('u1');
  });

  it('rejects login with wrong password', async () => {
    const { service, users, usersStore } = makeService();
    const user = {
      id: 'u1',
      email: 'a@b.co',
      role: 'user',
      passwordHash: await bcrypt.hash('password1', 4),
    };
    usersStore.set('u1', user);
    users.findOneBy.mockImplementation(async (w: any) =>
      w.email === 'a@b.co' ? user : null,
    );
    await expect(service.login('a@b.co', 'wrong')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects login for unknown user', async () => {
    const { service } = makeService();
    await expect(service.login('nobody@b.co', 'x')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rotates refresh token: old one is invalidated after refresh', async () => {
    const { service, refreshTokens } = makeService();
    const first = await service.register('a@b.co', 'password1');
    const oldHash = sha256(first.refreshToken);

    const second = await service.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    // First token should be gone
    refreshTokens.findOneBy.mockClear();
    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(refreshTokens.findOneBy).toHaveBeenCalledWith({ tokenHash: oldHash });
  });

  it('rejects refresh past expiry', async () => {
    const { service, refreshTokens } = makeService();
    const first = await service.register('a@b.co', 'password1');
    // Manually expire
    const hash = sha256(first.refreshToken);
    const row = await refreshTokens.findOneBy({ tokenHash: hash });
    row.expiresAt = new Date(Date.now() - 1000);
    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects refresh with missing token', async () => {
    const { service } = makeService();
    await expect(service.refresh(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logout is idempotent for unknown tokens', async () => {
    const { service } = makeService();
    await expect(service.logout('bogus')).resolves.toEqual({ ok: true });
    await expect(service.logout(undefined)).resolves.toEqual({ ok: true });
  });
});
