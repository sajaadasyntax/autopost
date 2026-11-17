import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('accepts the password that was saved', async () => {
    const stored = await hashPassword('correct-horse');
    await expect(verifyPassword('correct-horse', stored)).resolves.toBe(true);
    await expect(verifyPassword('wrong-horse', stored)).resolves.toBe(false);
  });
});
