import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  MessageBody, ConnectedSocket, OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { UseGuards, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'

@WebSocketGateway({
  namespace:   '/chat',
  cors:        { origin: '*', credentials: true },
  transports:  ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server
  private readonly logger = new Logger(ChatGateway.name)

  // userId → socketId mapping
  private userSockets = new Map<string, string>()

  constructor(
    private prisma:  PrismaService,
    private jwt:     JwtService,
    private config:  ConfigService,
  ) {}

  // ─── CONNECTION ──────────────────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token
        ?? client.handshake.headers?.authorization?.replace('Bearer ', '')

      if (!token) { client.disconnect(); return }

      const payload = this.jwt.verify(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      }) as { sub: string }

      const user = await this.prisma.user.findUnique({
        where:  { id: payload.sub },
        select: { id: true, name: true, isActive: true },
      })

      if (!user?.isActive) { client.disconnect(); return }

      // Attach userId to socket
      ;(client as any).userId = user.id
      this.userSockets.set(user.id, client.id)

      // Auto-join all chat rooms the user is part of
      const rooms = await this.prisma.chatRoom.findMany({
        where: {
          OR: [{ tenantId: user.id }, { ownerId: user.id }],
        },
        select: { id: true },
      })
      rooms.forEach((r) => client.join(`room:${r.id}`))

      this.logger.log(`✓ ${user.name} connected (${client.id})`)
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client as any).userId
    if (userId) this.userSockets.delete(userId)
    this.logger.log(`Client disconnected: ${client.id}`)
  }

  // ─── JOIN ROOM ───────────────────────────────────────────────────────────────

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = (client as any).userId
    const room   = await this.prisma.chatRoom.findFirst({
      where: {
        id: data.roomId,
        OR: [{ tenantId: userId }, { ownerId: userId }],
      },
    })
    if (!room) return { error: 'Room not found or access denied' }

    client.join(`room:${room.id}`)
    return { joined: room.id }
  }

  // ─── SEND MESSAGE ────────────────────────────────────────────────────────────

  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; content: string; type?: 'text' | 'image' },
  ) {
    const senderId = (client as any).userId
    if (!senderId) return { error: 'Not authenticated' }

    // Verify sender is in this room
    const room = await this.prisma.chatRoom.findFirst({
      where: {
        id: data.roomId,
        OR: [{ tenantId: senderId }, { ownerId: senderId }],
      },
    })
    if (!room) return { error: 'Room not found' }

    if (!data.content?.trim()) return { error: 'Empty message' }

    // Save message
    const message = await this.prisma.chatMessage.create({
      data: {
        roomId:   data.roomId,
        senderId,
        content:  data.content.trim(),
        type:     data.type ?? 'text',
      },
      include: {
        sender: { select: { id: true, name: true, profilePhoto: true } },
      },
    })

    // Update room last message
    await this.prisma.chatRoom.update({
      where: { id: data.roomId },
      data:  { lastMessage: data.content.trim(), lastMessageAt: new Date() },
    })

    // Emit to everyone in the room (including sender — for multi-device)
    this.server.to(`room:${data.roomId}`).emit('new_message', message)

    // Push notification to offline recipient
    const recipientId = senderId === room.tenantId ? room.ownerId : room.tenantId
    const isOnline    = this.userSockets.has(recipientId)
    if (!isOnline) {
      // Queued via BullMQ — handled by NotificationsService
      this.server.emit(`push_needed:${recipientId}`, {
        type:    'new_message',
        roomId:  data.roomId,
        message: data.content.trim().substring(0, 50),
        senderId,
      })
    }

    return { success: true, messageId: message.id }
  }

  // ─── MARK AS READ ─────────────────────────────────────────────────────────────

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; upToMessageId: string },
  ) {
    const userId = (client as any).userId

    await this.prisma.chatMessage.updateMany({
      where: {
        roomId:    data.roomId,
        id:        { lte: data.upToMessageId },
        senderId:  { not: userId }, // only mark messages from the other person
        readAt:    null,
      },
      data: { readAt: new Date() },
    })

    // Notify sender their messages were read
    const room = await this.prisma.chatRoom.findUnique({ where: { id: data.roomId } })
    if (room) {
      const otherId = userId === room.tenantId ? room.ownerId : room.tenantId
      const otherSocketId = this.userSockets.get(otherId)
      if (otherSocketId) {
        this.server.to(otherSocketId).emit('messages_read', {
          roomId: data.roomId,
          readBy: userId,
        })
      }
    }

    return { success: true }
  }

  // ─── TYPING INDICATOR ────────────────────────────────────────────────────────

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isTyping: boolean },
  ) {
    const userId = (client as any).userId
    client.to(`room:${data.roomId}`).emit('user_typing', {
      userId,
      isTyping: data.isTyping,
    })
  }

  // ─── HELPER: emit to specific user ───────────────────────────────────────────

  emitToUser(userId: string, event: string, data: any) {
    const socketId = this.userSockets.get(userId)
    if (socketId) this.server.to(socketId).emit(event, data)
  }
}
