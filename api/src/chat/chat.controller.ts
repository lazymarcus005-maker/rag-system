import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';

class ChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;
}

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  create(@Req() req: any) {
    return this.chat.createConversation(req.user.sub);
  }

  @Get()
  list(@Req() req: any) {
    return this.chat.listConversations(req.user.sub);
  }

  @Get(':id/messages')
  messages(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.chat.getMessages(id, req.user.sub);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.chat.deleteConversation(id, req.user.sub);
  }

  @Post(':id/chat')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async stream(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChatDto,
    @Req() req: any,
    @Res() res: Response,
  ) {
    await this.chat.streamAnswer(id, req.user.sub, dto.content, res);
  }
}
