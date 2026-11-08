import { Global, Module } from '@nestjs/common';
import { TokenCipher } from './token-cipher.service';

@Global()
@Module({
  providers: [TokenCipher],
  exports: [TokenCipher],
})
export class CryptoModule {}
