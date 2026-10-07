import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // Get all chat rooms for the current user
  async getRooms(userId: string) {
    const rooms = await this.prisma.chatRoom.findMany({
      where: { OR: [{ tenantId: userId }, { ownerId: userId }] },
      include: {
        booking: {
          include: {
            property: { select: { title: true, city: true,
              photos: { where: { isPrimary: true }, take: 1 } } },
          },
        },
      },
      orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
    })

    // Attach unread count per room
    const roomsWithUnread = await Promise.all(
      rooms.map(async (room) => {
        const unread = await this.prisma.chatMessage.count({
          where: {
            roomId:   room.id,
            senderId: { not: userId },
            readAt:   null,
          },
        })
        return { ...room, unreadCount: unread }
      }),
    )

    return roomsWithUnread
  }

  // Get message history for a room (paginated)
  async getMessages(userId: string, roomId: string, page = 1, limit = 50) {
    const room = await this.prisma.chatRoom.findFirst({
      where: { id: roomId, OR: [{ tenantId: userId }, { ownerId: userId }] },
    })
    if (!room) throw new NotFoundException('Chat room not found')

    const skip = (page - 1) * limit

    const [messages, total] = await this.prisma.$transaction([
      this.prisma.chatMessage.findMany({
        where:   { roomId },
        skip, take: limit,
        orderBy: { createdAt: 'desc' }, // latest first
        include: { sender: { select: { id: true, name: true, profilePhoto: true } } },
      }),
      this.prisma.chatMessage.count({ where: { roomId } }),
    ])

    // Mark fetched messages as read
    await this.prisma.chatMessage.updateMany({
      where: { roomId, senderId: { not: userId }, readAt: null },
      data:  { readAt: new Date() },
    })

    return {
      data:       messages.reverse(), // chronological order
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }
}

// ─── CONTROLLER ──────────────────────────────────────────────────────────────

import {
  Controller, Get, Param, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { RolesGuard }  from '../auth/guards/index'
import { CurrentUser } from '../../common/decorators/index'
import { User }        from '@prisma/client'

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly svc: ChatService) {}

  @Get('rooms')
  @ApiOperation({ summary: 'Get all chat rooms for current user (with unread count)' })
  getRooms(@CurrentUser() user: User) {
    return this.svc.getRooms(user.id)
  }

  @Get('rooms/:roomId/messages')
  @ApiOperation({ summary: 'Get paginated message history for a room' })
  @ApiQuery({ name: 'page',  required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getMessages(
    @CurrentUser() user: User,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Query('page')  page?:  string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getMessages(
      user.id, roomId,
      Number(page ?? 1),
      Number(limit ?? 50),
    )
  }
}
