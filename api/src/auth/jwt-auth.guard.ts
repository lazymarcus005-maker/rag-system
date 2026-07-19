import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AuthUser {
  sub: string;
  email: string;
  role: 'admin' | 'user';
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    let token: string | undefined;
    if (header?.startsWith('Bearer ')) {
      token = header.slice(7);
    } else if (req.cookies?.access_token) {
      token = req.cookies.access_token;
    }
    if (!token) throw new UnauthorizedException('Missing token');
    try {
      req.user = await this.jwt.verifyAsync<AuthUser>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
