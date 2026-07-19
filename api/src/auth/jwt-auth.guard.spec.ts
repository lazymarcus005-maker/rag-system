import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeContext(req: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function makeGuard(verifyResult: unknown = { sub: 'u1', email: 'a@b.co', role: 'user' }) {
  const jwt = { verifyAsync: jest.fn(async () => verifyResult) };
  const guard = new JwtAuthGuard(jwt as any);
  return { guard, jwt };
}

describe('JwtAuthGuard', () => {
  it('reads token from Authorization header', async () => {
    const { guard, jwt } = makeGuard();
    const req: any = { headers: { authorization: 'Bearer header.jwt.token' }, cookies: {} };
    const result = await guard.canActivate(makeContext(req));
    expect(result).toBe(true);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('header.jwt.token');
    expect(req.user).toMatchObject({ sub: 'u1' });
  });

  it('falls back to access_token cookie when no header', async () => {
    const { guard, jwt } = makeGuard();
    const req: any = { headers: {}, cookies: { access_token: 'cookie.jwt.token' } };
    const result = await guard.canActivate(makeContext(req));
    expect(result).toBe(true);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('cookie.jwt.token');
  });

  it('prefers header when both present', async () => {
    const { guard, jwt } = makeGuard();
    const req: any = {
      headers: { authorization: 'Bearer header.jwt' },
      cookies: { access_token: 'cookie.jwt' },
    };
    await guard.canActivate(makeContext(req));
    expect(jwt.verifyAsync).toHaveBeenCalledWith('header.jwt');
  });

  it('throws UnauthorizedException when neither header nor cookie', async () => {
    const { guard } = makeGuard();
    const req: any = { headers: {}, cookies: {} };
    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when verifyAsync throws', async () => {
    const jwt = { verifyAsync: jest.fn(async () => { throw new Error('jwt malformed'); }) };
    const guard = new JwtAuthGuard(jwt as any);
    const req: any = { headers: { authorization: 'Bearer bad' }, cookies: {} };
    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});