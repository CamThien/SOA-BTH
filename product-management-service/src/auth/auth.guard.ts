import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;
    if (!/^Bearer \S+$/i.test(authorization || '')) throw new UnauthorizedException('Bearer token is required');
    try {
      await axios.get(`${process.env.AUTH_SERVICE_URL || 'http://localhost:3000'}/auth`, { headers: { Authorization: authorization }, timeout: 5000 });
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && [401, 403].includes(error.response?.status || 0)) throw new UnauthorizedException('Invalid or expired token');
      throw new ServiceUnavailableException('Authentication service is unavailable');
    }
  }
}
