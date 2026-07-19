import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { Repository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { ChatMessage, OllamaService } from '../llm/ollama.service';
import { RetrievalService } from '../retrieval/retrieval.service';

const HISTORY_LIMIT = 10;
const HEARTBEAT_INTERVAL_MS = 15_000;

const SYSTEM_PROMPT = `คุณคือผู้ช่วยตอบคำถามจากเอกสารขององค์กร (RAG assistant)
- ตอบโดยอ้างอิงจาก "บริบทเอกสาร" ที่ให้มาเท่านั้น
- ถ้าบริบทไม่มีข้อมูลเพียงพอ ให้บอกตรง ๆ ว่าไม่พบข้อมูลในเอกสาร อย่าเดา
- ตอบเป็นภาษาเดียวกับที่ผู้ใช้ถาม
- อ้างอิงแหล่งที่มาด้วยหมายเลข [1], [2] ตามลำดับบริบทที่ใช้`;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    private readonly retrieval: RetrievalService,
    private readonly ollama: OllamaService,
  ) {}

  createConversation(userId: string) {
    return this.conversations.save(this.conversations.create({ userId }));
  }

  listConversations(userId: string) {
    return this.conversations.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async getMessages(conversationId: string, userId: string) {
    await this.assertOwnership(conversationId, userId);
    return this.messages.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  async deleteConversation(conversationId: string, userId: string) {
    await this.assertOwnership(conversationId, userId);
    await this.conversations.delete(conversationId);
    return { ok: true };
  }

  private async assertOwnership(conversationId: string, userId: string) {
    const convo = await this.conversations.findOneBy({ id: conversationId, userId });
    if (!convo) throw new NotFoundException('Conversation not found');
    return convo;
  }

  // แปลงคำถามต่อเนื่อง ("แล้วอันนั้นล่ะ?") เป็นคำถามสมบูรณ์ก่อน retrieve
  private async rewriteQuery(prior: Message[], content: string): Promise<string> {
    if (prior.length === 0) return content;
    try {
      const recent = prior
        .slice(-6)
        .map((m) => `${m.role === 'user' ? 'ผู้ใช้' : 'ผู้ช่วย'}: ${m.content.slice(0, 300)}`)
        .join('\n');
      const raw = await this.ollama.chat([
        {
          role: 'user',
          content: `จากบทสนทนาต่อไปนี้:
${recent}

คำถามล่าสุดของผู้ใช้: "${content}"

เขียนคำถามล่าสุดใหม่ให้เป็นคำถามที่สมบูรณ์ในตัวเอง (standalone) โดยแทนคำสรรพนามหรือคำอ้างอิงด้วยสิ่งที่หมายถึงจริง ใช้ภาษาเดียวกับคำถามเดิม
ตอบเฉพาะคำถามที่เขียนใหม่เท่านั้น ห้ามมีข้อความอื่น`,
        },
      ]);
      const rewritten = raw.trim().replace(/^["'“]+|["'”]+$/g, '');
      return rewritten.length > 0 && rewritten.length <= 500 ? rewritten : content;
    } catch {
      return content;
    }
  }

  async streamAnswer(
    conversationId: string,
    userId: string,
    content: string,
    res: Response,
  ) {
    const convo = await this.assertOwnership(conversationId, userId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const send = (payload: unknown) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
    // Keep the connection alive through idle proxies during long LLM generation.
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(`: ping\n\n`);
    }, HEARTBEAT_INTERVAL_MS);

    try {
      const prior = await this.messages.find({
        where: { conversationId },
        order: { createdAt: 'DESC' },
        take: HISTORY_LIMIT,
      });
      prior.reverse();

      await this.messages.save(
        this.messages.create({ conversationId, role: 'user', content }),
      );
      if (convo.title === 'New chat') {
        await this.conversations.update(convo.id, { title: content.slice(0, 80) });
      }

      // ยกเลิก stream จาก Ollama ทันทีเมื่อ client ปิด connection
      const abort = new AbortController();
      res.on('close', () => {
        if (!res.writableEnded) abort.abort();
      });

      const searchQuery = await this.rewriteQuery(prior, content);
      const sources = await this.retrieval.search(searchQuery);
      send({
        type: 'sources',
        sources: sources.map((s, i) => ({
          ref: i + 1,
          chunkId: s.id,
          documentId: s.documentId,
          documentTitle: s.documentTitle,
          page: s.page,
          section: s.section,
          snippet: s.content.slice(0, 200),
        })),
      });

      if (sources.length === 0) {
        const noResult =
          'ไม่พบข้อมูลที่เกี่ยวข้องในเอกสารที่มีอยู่ในระบบ กรุณาลองถามด้วยคำอื่น หรือติดต่อผู้ดูแลระบบเพื่อเพิ่มเอกสาร';
        send({ type: 'token', token: noResult });
        await this.messages.save(
          this.messages.create({ conversationId, role: 'assistant', content: noResult }),
        );
        send({ type: 'done' });
        return;
      }

      const context = sources
        .map((s, i) => {
          const location = [
            s.page ? `หน้า ${s.page}` : null,
            s.section ? `หัวข้อ "${s.section}"` : null,
          ]
            .filter(Boolean)
            .join(', ');
          return `[${i + 1}] (${s.documentTitle}${location ? ` — ${location}` : ''})\n${s.content}`;
        })
        .join('\n\n---\n\n');

      const llmMessages: ChatMessage[] = [
        { role: 'system', content: `${SYSTEM_PROMPT}\n\nบริบทเอกสาร:\n${context}` },
        ...prior.map((m): ChatMessage => ({ role: m.role, content: m.content })),
        { role: 'user', content },
      ];

      let answer = '';
      try {
        for await (const token of this.ollama.chatStream(llmMessages, abort.signal)) {
          answer += token;
          send({ type: 'token', token });
        }
      } catch (err) {
        // ถ้า client ยกเลิกเอง ไม่ถือเป็น error — เก็บคำตอบบางส่วนไว้
        if (!abort.signal.aborted) throw err;
      }

      if (answer) {
        await this.messages.save(
          this.messages.create({
            conversationId,
            role: 'assistant',
            content: answer,
            citedChunkIds: sources.map((s) => s.id),
          }),
        );
      }
      if (!abort.signal.aborted) send({ type: 'done' });
    } catch (err) {
      this.logger.error(
        { err, conversationId, userId },
        'Chat stream failed',
      );
      send({ type: 'error', message: 'Streaming failed' });
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  }
}
