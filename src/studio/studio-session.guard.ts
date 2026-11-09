import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { User } from '@prisma/client';
import { StudioAuthService } from './studio-auth.service';

export type StudioRequest = Request & { studioUser?: User };

@Injectable()
export class StudioSessionGuard implements CanActivate {
  constructor(private readonly auth: StudioAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StudioRequest>();
    const header = request.header('authorization') ?? '';
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    request.studioUser = await this.auth.userForToken(token);
    return true;
  }
}
