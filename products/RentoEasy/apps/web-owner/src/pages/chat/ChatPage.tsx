import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate }      from 'react-router-dom'
import { useQuery, useQueryClient }    from '@tanstack/react-query'
import { io, Socket }                  from 'socket.io-client'
import { Send, ArrowLeft, Loader2 }    from 'lucide-react'
import { chatAPI }                     from '@/services/api'
import { useAuthStore }                from '@/store/authStore'

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4020'

export default function ChatPage() {
  const { roomId } = useParams<{ roomId?: string }>()
  const navigate   = useNavigate()
  const { user }   = useAuthStore()

  const { data: rooms } = useQuery({
    queryKey: ['owner-chat-rooms'],
    queryFn:  () => chatAPI.getRooms() as any,
    refetchInterval: 10000,
  })

  const roomList = (rooms as any) ?? []
  const selected = roomId ?? roomList[0]?.id

  return (
    <div className="flex h-full overflow-hidden">
      {/* Room list */}
      <div className={`${selected ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-72 border-r border-gray-100 bg-white shrink-0`}>
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {roomList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12 text-gray-400">
              <div className="text-4xl mb-2">💬</div>
              <p className="text-sm font-medium text-gray-700">No messages yet</p>
              <p className="text-xs mt-1">Tenant messages appear here after you accept a booking</p>
            </div>
          ) : (
            roomList.map((room: any) => {
              const other = room.ownerId === user?.id ? room.tenant : room.owner
              const photo = room.booking?.property?.photos?.[0]?.thumbnailUrl
              return (
                <button key={room.id} onClick={() => navigate(`/chat/${room.id}`)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left
                    ${room.id === selected ? 'bg-violet-50 border-r-2 border-violet-600' : ''}`}>
                  <div className="w-11 h-11 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {photo
                      ? <img src={photo} alt="" className="w-full h-full object-cover" />
                      : <span className="text-xs font-bold text-gray-500">{other?.name?.charAt(0)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{other?.name ?? 'Tenant'}</p>
                      {room.lastMessageAt && (
                        <span className="text-xs text-gray-400 shrink-0">
                          {new Date(room.lastMessageAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{room.booking?.property?.title}</p>
                    {room.lastMessage && <p className="text-xs text-gray-500 truncate">{room.lastMessage}</p>}
                  </div>
                  {room.unreadCount > 0 && (
                    <span className="w-5 h-5 bg-violet-600 text-white text-xs rounded-full flex items-center justify-center font-bold shrink-0">
                      {room.unreadCount > 9 ? '9+' : room.unreadCount}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Thread */}
      <div className={`${!selected ? 'hidden md:flex' : 'flex'} flex-1 flex-col overflow-hidden`}>
        {selected
          ? <ChatThread roomId={selected} userId={user?.id ?? ''} onBack={() => navigate('/chat')} />
          : <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center"><div className="text-5xl mb-3">💬</div><p className="text-sm">Select a conversation</p></div>
            </div>
        }
      </div>
    </div>
  )
}

function ChatThread({ roomId, userId, onBack }: { roomId: string; userId: string; onBack: () => void }) {
  const qc = useQueryClient()
  const [text, setText]     = useState('')
  const [messages, setMessages] = useState<any[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const [typing, setTyping] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const { data: histData, isLoading } = useQuery({
    queryKey: ['owner-messages', roomId],
    queryFn:  () => chatAPI.getMessages(roomId) as any,
    enabled:  !!roomId,
  })

  useEffect(() => { if (histData?.data) setMessages(histData.data) }, [histData])

  useEffect(() => {
    const token = localStorage.getItem('ras_owner_access')
    const s = io(`${SOCKET_URL}/chat`, { auth: { token }, transports: ['websocket'] })
    s.on('connect', () => s.emit('join_room', { roomId }))
    s.on('new_message', (msg: any) => {
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])
      s.emit('mark_read', { roomId, upToMessageId: msg.id })
    })
    s.on('user_typing', ({ isTyping }: any) => setTyping(isTyping))
    setSocket(s)
    return () => { s.disconnect() }
  }, [roomId])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing])

  const send = () => {
    const c = text.trim(); if (!c || !socket) return
    socket.emit('send_message', { roomId, content: c, type: 'text' })
    socket.emit('typing', { roomId, isTyping: false })
    setText('')
  }

  const rooms = (qc.getQueryData(['owner-chat-rooms']) as any) ?? []
  const room  = rooms.find((r: any) => r.id === roomId)
  const other = room?.tenant

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <button onClick={onBack} className="md:hidden p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
          {other?.profilePhoto
            ? <img src={other.profilePhoto} alt="" className="w-full h-full object-cover" />
            : <span className="text-sm font-bold text-gray-500">{other?.name?.charAt(0)}</span>}
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">{other?.name ?? 'Tenant'}</p>
          <p className="text-xs text-gray-400">{room?.booking?.property?.title}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading && <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>}
        {messages.map((msg: any) => {
          const isMine = msg.senderId === userId
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed
                ${isMine ? 'bg-violet-700 text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'}`}>
                {msg.content}
                <div className={`text-[10px] mt-1 ${isMine ? 'text-white/60 text-right' : 'text-gray-400'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                  {isMine && msg.readAt && ' ✓✓'}
                </div>
              </div>
            </div>
          )
        })}
        {typing && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2.5 rounded-2xl rounded-bl-sm flex gap-1">
              {[0,150,300].map((d) => (
                <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="px-4 py-3 border-t border-gray-100 bg-white flex gap-2">
        <input className="input flex-1 rounded-2xl" placeholder="Type a message…" value={text}
          onChange={(e) => { setText(e.target.value); socket?.emit('typing',{roomId,isTyping:e.target.value.length>0}) }}
          onKeyDown={(e) => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()} }} />
        <button onClick={send} disabled={!text.trim()}
          className="w-10 h-10 bg-violet-700 text-white rounded-full flex items-center justify-center hover:bg-violet-800 disabled:opacity-40 transition-colors shrink-0">
          <Send size={16} />
        </button>
      </div>
    </>
  )
}
