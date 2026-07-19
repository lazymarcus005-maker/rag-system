import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class DimensionMismatchError extends Error {
  constructor(expected: number, actual: number, model: string) {
    super(
      `Embedding dimension mismatch: EMBEDDING_DIM=${expected} but Ollama model "${model}" returned ${actual}-dim vectors. Update EMBEDDING_DIM to match the model.`,
    );
    this.name = 'DimensionMismatchError';
  }
}

@Injectable()
export class OllamaService implements OnModuleInit {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  readonly chatModel: string;
  readonly embedModel: string;
  private readonly embeddingDim: number;
  private readonly logger = new Logger(OllamaService.name);

  constructor(config: ConfigService) {
    this.baseUrl = config.get('OLLAMA_BASE_URL', 'http://localhost:11434');
    this.apiKey = config.get('OLLAMA_API_KEY');
    this.chatModel = config.get('OLLAMA_CHAT_MODEL', 'llama3.1:8b');
    this.embedModel = config.get('OLLAMA_EMBED_MODEL', 'bge-m3');
    this.embeddingDim = Number(config.get('EMBEDDING_DIM', 1024));
  }

  async onModuleInit() {
    try {
      const [probe] = await this.embed(['dimension check']);
      if (probe.length !== this.embeddingDim) {
        throw new DimensionMismatchError(this.embeddingDim, probe.length, this.embedModel);
      }
    } catch (err) {
      if (err instanceof DimensionMismatchError) {
        throw err;
      }
      this.logger.warn(
        `Ollama unreachable during startup probe; skipping dimension validation: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
    return headers;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model: this.embedModel, input: texts }),
    });
    if (!res.ok) {
      throw new InternalServerErrorException(
        `Ollama embed failed (${res.status}): ${await res.text()}`,
      );
    }
    const data = (await res.json()) as { embeddings: number[][] };
    return data.embeddings;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model: this.chatModel, messages, stream: false }),
    });
    if (!res.ok) {
      throw new InternalServerErrorException(
        `Ollama chat failed (${res.status}): ${await res.text()}`,
      );
    }
    const data = (await res.json()) as { message?: { content?: string } };
    return data.message?.content ?? '';
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/version`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async *chatStream(
    messages: ChatMessage[],
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model: this.chatModel, messages, stream: true }),
      signal,
    });
    if (!res.ok || !res.body) {
      throw new InternalServerErrorException(
        `Ollama chat failed (${res.status}): ${await res.text()}`,
      );
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line) continue;
        const parsed = JSON.parse(line) as {
          message?: { content?: string };
          done?: boolean;
        };
        if (parsed.message?.content) yield parsed.message.content;
        if (parsed.done) return;
      }
    }
  }
}
