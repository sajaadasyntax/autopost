import { Injectable } from '@nestjs/common';
import Anthropic, { APIError } from '@anthropic-ai/sdk';
import { HttpError, PermanentError } from '../common/errors';
import { AppConfigService } from '../config/app-config.service';
import { PostCopy, buildContentPrompt, localCopy, normalizeCopy } from './format-copy';

const SUBMIT_POST = {
  name: 'submit_post',
  description: 'Submit one Facebook and Instagram post.',
  input_schema: {
    type: 'object' as const,
    properties: {
      headline: { type: 'string' },
      caption: { type: 'string' },
      hashtags: { type: 'array', items: { type: 'string' } },
      cta: { type: 'string' },
    },
    required: ['headline', 'caption', 'hashtags', 'cta'],
  },
};

@Injectable()
export class ContentService {
  private client: Anthropic | null = null;

  constructor(private readonly config: AppConfigService) {}

  async generate(input: {
    name: string;
    tone: string;
    audience: string;
    brief: string;
    revision?: string;
  }): Promise<PostCopy> {
    if (!this.config.env.anthropicApiKey) {
      if (this.config.env.localDev) {
        return localCopy(input);
      }
      throw new PermanentError('ANTHROPIC_API_KEY is not configured.');
    }
    const prompt = buildContentPrompt(input);
    try {
      const response = await this.anthropic().messages.create({
        model: this.config.env.claudeModel,
        max_tokens: 1024,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
        tools: [SUBMIT_POST],
        tool_choice: { type: 'tool', name: 'submit_post' },
      });
      const tool = response.content.find((block) => block.type === 'tool_use');
      if (!tool || tool.type !== 'tool_use') {
        throw new PermanentError('Claude did not return a post.');
      }
      return normalizeCopy(tool.input);
    } catch (error) {
      if (error instanceof PermanentError) {
        throw error;
      }
      if (error instanceof APIError) {
        throw new HttpError(error.message, error.status ?? 500);
      }
      throw error;
    }
  }

  private anthropic(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: this.config.env.anthropicApiKey });
    }
    return this.client;
  }
}
