import { Injectable } from '@nestjs/common';
import Anthropic, { APIError } from '@anthropic-ai/sdk';
import { HttpError, PermanentError } from '../common/errors';
import { requestJson } from '../common/http';
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
    const prompt = buildContentPrompt(input);
    if (!this.config.env.anthropicApiKey) {
      if (this.config.env.geminiApiKey) {
        return this.gemini(prompt);
      }
      if (this.config.env.localDev) {
        return localCopy(input);
      }
      throw new PermanentError('Set GEMINI_API_KEY or ANTHROPIC_API_KEY.');
    }
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

  private async gemini(prompt: { system: string; user: string }): Promise<PostCopy> {
    const model = this.config.env.geminiModel;
    const { body } = await requestJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.config.env.geminiApiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt.system }] },
          contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                headline: { type: 'STRING' },
                caption: { type: 'STRING' },
                hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
                cta: { type: 'STRING' },
              },
              required: ['headline', 'caption', 'hashtags', 'cta'],
            },
          },
        }),
      },
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(readGeminiText(body));
    } catch (error) {
      if (error instanceof PermanentError) {
        throw error;
      }
      throw new PermanentError('Gemini did not return a post.');
    }
    return normalizeCopy(parsed);
  }

  private anthropic(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: this.config.env.anthropicApiKey });
    }
    return this.client;
  }
}

function readGeminiText(body: unknown): string {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const candidates = Array.isArray(record.candidates) ? record.candidates : [];
  const first = candidates[0] && typeof candidates[0] === 'object' ? (candidates[0] as Record<string, unknown>) : {};
  const content = first.content && typeof first.content === 'object' ? (first.content as Record<string, unknown>) : {};
  const parts = Array.isArray(content.parts) ? content.parts : [];
  const part = parts[0] && typeof parts[0] === 'object' ? (parts[0] as Record<string, unknown>) : {};
  if (typeof part.text !== 'string' || !part.text.trim()) {
    throw new PermanentError('Gemini did not return a post.');
  }
  return part.text;
}
