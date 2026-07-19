## Commits
87d498f feat(chat): tighten stream rate limit to 6/min, add 20/min on create

## Stat
 api/src/chat/chat.controller.ts | 3 ++-
 1 file changed, 2 insertions(+), 1 deletion(-)

## Diff
diff --git a/api/src/chat/chat.controller.ts b/api/src/chat/chat.controller.ts
index dbe2762..aad46c7 100644
--- a/api/src/chat/chat.controller.ts
+++ b/api/src/chat/chat.controller.ts
@@ -22,40 +22,41 @@ class ChatDto {
   @MaxLength(4000)
   content: string;
 }
 
 @Controller('conversations')
 @UseGuards(JwtAuthGuard)
 export class ChatController {
   constructor(private readonly chat: ChatService) {}
 
   @Post()
+  @Throttle({ default: { limit: 20, ttl: 60_000 } })
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
-  @Throttle({ default: { limit: 20, ttl: 60_000 } })
+  @Throttle({ default: { limit: 6, ttl: 60_000 } })
   async stream(
     @Param('id', ParseUUIDPipe) id: string,
     @Body() dto: ChatDto,
     @Req() req: any,
     @Res() res: Response,
   ) {
     await this.chat.streamAnswer(id, req.user.sub, dto.content, res);
   }
 }
