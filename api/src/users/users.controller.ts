import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsIn } from 'class-validator';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles';
import { User } from '../entities/user.entity';

class RoleDto {
  @IsIn(['admin', 'user'])
  role: 'admin' | 'user';
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  @Get()
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const take = Math.min(limit ? Number(limit) : 100, 100);
    const skip = Math.max(offset ? Number(offset) : 0, 0);
    return this.users.find({
      select: ['id', 'email', 'role', 'createdAt'],
      order: { createdAt: 'ASC' },
      take,
      skip,
    });
  }

  @Patch(':id/role')
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RoleDto,
    @Req() req: any,
  ) {
    if (id === req.user.sub) {
      throw new ForbiddenException('ไม่สามารถเปลี่ยน role ของตัวเองได้');
    }
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    await this.users.update(id, { role: dto.role });
    return { ok: true };
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    if (id === req.user.sub) {
      throw new ForbiddenException('ไม่สามารถลบบัญชีของตัวเองได้');
    }
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    await this.users.delete(id);
    return { ok: true };
  }
}
