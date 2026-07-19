import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

function makeRes() {
  const cookies: Record<string, { value: string; opts: any }> = {};
  const cleared: string[] = [];
  const res: any = {
    cookie: jest.fn((name: string, value: string, opts: any) => {
      cookies[name] = { value, opts };
    }),
    clearCookie: jest.fn((name: string) => {
      cleared.push(name);
    }),
  };
  return { res, cookies, cleared };
}

function makeService() {
  return {
    register: jest.fn(async () => ({
      accessToken: 'access.jwt',
      refreshToken: 'refresh.jwt',
      user: { id: 'u1', email: 'a@b.co', role: 'user' },
    })),
    login: jest.fn(async () => ({
      accessToken: 'access.jwt',
      refreshToken: 'refresh.jwt',
      user: { id: 'u1', email: 'a@b.co', role: 'user' },
    })),
    refresh: jest.fn(async () => ({
      accessToken: 'access.jwt.new',
      refreshToken: 'refresh.jwt.new',
      user: { id: 'u1', email: 'a@b.co', role: 'user' },
    })),
    logout: jest.fn(async () => ({ ok: true })),
  } as unknown as AuthService;
}

describe('AuthController', () => {
  describe('login (respond)', () => {
    it('sets access_token cookie with httpOnly, sameSite=lax, path=/, maxAge=900000', async () => {
      const ctrl = new AuthController(makeService());
      const { res, cookies } = makeRes();
      await ctrl.login({ email: 'a@b.co', password: 'password1' }, res);
      expect(cookies.access_token).toBeDefined();
      expect(cookies.access_token.value).toBe('access.jwt');
      expect(cookies.access_token.opts).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 900000,
      });
    });

    it('sets refresh_token cookie with path=/auth', async () => {
      const ctrl = new AuthController(makeService());
      const { res, cookies } = makeRes();
      await ctrl.login({ email: 'a@b.co', password: 'password1' }, res);
      expect(cookies.refresh_token).toBeDefined();
      expect(cookies.refresh_token.opts).toMatchObject({
        httpOnly: true,
        path: '/auth',
      });
    });

    it('returns body without accessToken', async () => {
      const ctrl = new AuthController(makeService());
      const { res } = makeRes();
      const body = await ctrl.login({ email: 'a@b.co', password: 'password1' }, res);
      expect(body).not.toHaveProperty('accessToken');
      expect(body).toMatchObject({ user: { email: 'a@b.co', role: 'user' } });
    });

    it('sets secure=true in production', async () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const ctrl = new AuthController(makeService());
        const { res, cookies } = makeRes();
        await ctrl.login({ email: 'a@b.co', password: 'password1' }, res);
        expect(cookies.access_token.opts.secure).toBe(true);
      } finally {
        process.env.NODE_ENV = prev;
      }
    });
  });

  describe('register', () => {
    it('sets access_token cookie and returns body without accessToken', async () => {
      const ctrl = new AuthController(makeService());
      const { res, cookies } = makeRes();
      const body = await ctrl.register({ email: 'a@b.co', password: 'password1' }, res);
      expect(cookies.access_token).toBeDefined();
      expect(body).not.toHaveProperty('accessToken');
    });
  });

  describe('refresh', () => {
    it('sets a new access_token cookie and returns body without accessToken', async () => {
      const ctrl = new AuthController(makeService());
      const req: any = { cookies: { refresh_token: 'refresh.jwt' } };
      const { res, cookies } = makeRes();
      const body = await ctrl.refresh(req, res);
      expect(cookies.access_token.value).toBe('access.jwt.new');
      expect(body).not.toHaveProperty('accessToken');
    });
  });

  describe('logout', () => {
    it('clears both access_token and refresh_token cookies', async () => {
      const ctrl = new AuthController(makeService());
      const req: any = { cookies: { refresh_token: 'refresh.jwt' } };
      const { res, cleared } = makeRes();
      await ctrl.logout(req, res);
      expect(cleared).toEqual(expect.arrayContaining(['access_token', 'refresh_token']));
    });
  });
});