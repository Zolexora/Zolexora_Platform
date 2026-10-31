import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient }  from '@tanstack/react-query'
import { useParams, useNavigate }    from 'react-router-dom'
import { io, Socket }                from 'socket.io-client'
import { Send, ArrowLeft, Loader2 }  from 'lucide-react'
import { chatAPI }                   from '@/services/api'
import { useAuthStore }              from '@/store/authStore'

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4020'

export default function ChatPage() {
  const { roomId } = useParams<{ roomId?: string }>()
  const navigate   = useNavigate()
  const { user }   = useAuthStore()

  const { data: rooms } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn:  () => chatAPI.getRooms() as any,
    refetchInterval: 10000,
  })

  const roomList = (rooms as any) ?? []
  const selected = roomId ?? (roomList[0]?.id as string | undefined)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Room list — hidden on mobile when room selected */}
      <div className={`${selected ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-72 border-r border-gray-100 bg-white shrink-0`}>
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {roomList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12 text-gray-400">
              <div className="text-4xl mb-2">💬</div>
              <p className="text-sm font-medium text-gray-700">No messages yet</p>
              <p className="text-xs mt-1">Book a room to start chatting with owners</p>
            </div>
          ) : (
            roomList.map((room: any) => (
              <RoomRow
                key={room.id}
                room={room}
                active={room.id === selected}
                userId={user?.id ?? ''}
                onClick={() => navigate(`/chat/${room.id}`)}
              />
            ))
          )}
        </div>
      </div>

      {/* Thread */}
      <div className={`${!selected ? 'hidden md:flex' : 'flex'} flex-1 flex-col overflow-hidden`}>
        {selected ? (
          <ChatThread roomId={selected} userId={user?.id ?? ''} onBack={() => navigate('/chat')} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-5xl mb-3">💬</div>
              <p className="text-sm">Select a conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ROOM ROW ─────────────────────────────────────────────────────────────────

function RoomRow({ room, active, userId, onClick }: any) {
  const other = room.tenantId === userId ? room.owner : room.tenant
  const name  = other?.name ?? 'User'
  const photo = room.booking?.property?.photos?.[0]?.thumbnailUrl

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left
                  ${active ? 'bg-brand-50 border-r-2 border-brand-600' : ''}`}
    >
      <div className="w-11 h-11 rounded-full bg-gray-100 overflow-hidden shrink-0">
        {photo
          ? <img src={photo} alt="" className="w-full h-full object-cover" />
          : <span className="w-full h-full flex items-center justify-center text-gray-500 font-semibold">
              {name.charAt(0)}
            </span>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
          {room.lastMessageAt && (
            <span className="text-xs text-gray-400 shrink-0">
              {timeLabel(room.lastMessageAt)}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate mt-0.5">
          {room.booking?.property?.title ?? 'Booking'}
        </p>
        {room.lastMessage && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{room.lastMessage}</p>
        )}
      </div>
      {room.unreadCount > 0 && (
        <span className="w-5 h-5 bg-brand-600 text-white text-xs rounded-full
                         flex items-center justify-center font-bold shrink-0">
          {room.unreadCount > 9 ? '9+' : room.unreadCount}
        </span>
      )}
    </button>
  )
}

// ─── CHAT THREAD ──────────────────────────────────────────────────────────────

function ChatThread({ roomId, userId, onBack }: { roomId: string; userId: string; onBack: () => void }) {
  const qc             = useQueryClient()
  const [text, setText] = useState('')
  const [messages, setMessages] = useState<any[]>([])
  const [typing, setTyping]     = useState(false)
  const [socket, setSocket]     = useState<Socket | null>(null)
  const [sending, setSending]   = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const typingTimer = useRef<any>(null)

  const { data: histData, isLoading } = useQuery({
    queryKey: ['messages', roomId],
    queryFn:  () => chatAPI.getMessages(roomId) as any,
    enabled:  !!roomId,
  })

  useEffect(() => {
    if (histData?.data) setMessages(histData.data)
  }, [histData])

  // Connect Socket.io
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const s = io(`${SOCKET_URL}/chat`, {
      auth:       { token },
      transports: ['websocket'],
    })

    s.on('connect', () => {
      s.emit('join_room', { roomId })
    })

    s.on('new_message', (msg: any) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      s.emit('mark_read', { roomId, upToMessageId: msg.id })
    })

    s.on('user_typing', ({ isTyping }: any) => {
      setTyping(isTyping)
      if (isTyping) {
        clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setTyping(false), 3000)
      }
    })

    setSocket(s)
    return () => { s.disconnect() }
  }, [roomId])

  // Scroll to bottom on new message
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const sendMessage = () => {
    const content = text.trim()
    if (!content || !socket || sending) return
    setSending(true)
    socket.emit('send_message', { roomId, content, type: 'text' }, () => setSending(false))
    socket.emit('typing', { roomId, isTyping: false })
    setText('')
  }

  const handleTyping = (val: string) => {
    setText(val)
    socket?.emit('typing', { roomId, isTyping: val.length > 0 })
  }

  // Get header info
  const rooms   = (qc.getQueryData(['chat-rooms']) as any) ?? []
  const room    = rooms.find((r: any) => r.id === roomId)
  const other   = room?.tenantId === userId ? room?.owner : room?.tenant
  const propTitle = room?.booking?.property?.title ?? ''

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <button onClick={onBack} className="md:hidden p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden shrink-0">
          {other?.profilePhoto
            ? <img src={other.profilePhoto} alt="" className="w-full h-full object-cover" />
            : <span className="w-full h-full flex items-center justify-center text-sm font-semibold text-gray-500">
                {other?.name?.charAt(0)}
              </span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{other?.name ?? 'Owner'}</p>
          <p className="text-xs text-gray-400 truncate">{propTitle}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        )}

        {messages.map((msg: any) => {
          const isMine = msg.senderId === userId
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed
                ${isMine
                  ? 'bg-brand-700 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }`}
              >
                {msg.content}
                <div className={`text-[10px] mt-1 ${isMine ? 'text-white/60 text-right' : 'text-gray-400'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  {isMine && msg.readAt && ' ✓✓'}
                </div>
              </div>
            </div>
          )
        })}

        {/* Typing indicator */}
        {typing && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-1">
              {[0, 150, 300].map((d) => (
                <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 bg-white flex gap-2">
        <input
          className="input flex-1 rounded-2xl"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => handleTyping(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim() || sending}
          className="w-10 h-10 bg-brand-700 text-white rounded-full flex items-center justify-center
                     hover:bg-brand-800 disabled:opacity-40 transition-colors shrink-0"
        >
          <Send size={16} />
        </button>
      </div>
    </>
  )
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function timeLabel(iso: string): string {
  const d    = new Date(iso)
  const now  = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000)  return 'now'
  if (diff < 3600000) return `${Math.floor(diff/60000)}m`
  if (diff < 86400000) return d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })
  return d.toLocaleDateString('en-IN', { day:'numeric', month:'short' })
}
