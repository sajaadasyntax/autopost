import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { decryptString, encryptString } from './token-cipher';

@Injectable()
export class TokenCipher {
  constructor(private readonly config: AppConfigService) {}

  encrypt(plain: string): string {
    return encryptString(plain, this.config.env.encryptionKey);
  }

  decrypt(payload: string): string {
    return decryptString(payload, this.config.env.encryptionKey);
  }
}
