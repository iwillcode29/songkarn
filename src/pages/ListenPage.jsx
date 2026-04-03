import { useParams } from 'react-router-dom'
import { useVoiceChat } from '../hooks/useVoiceChat'

/**
 * Audio-only listener page. Anyone with this link hears all players' voice chat.
 * No mic, no player registration — just receive and play audio.
 */
export default function ListenPage() {
  const { roomId } = useParams()
  const { activeSpeakers } = useVoiceChat({
    roomId,
    peerId: `listener-${roomId}-${Math.random().toString(36).slice(2, 7)}`,
    micEnabled: false,
    playAudio: true,
  })

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-gradient-to-b from-blue-950 to-slate-900 px-6 text-center space-y-6">
      <div className="text-6xl animate-pulse">🔊</div>
      <div>
        <h1 className="text-2xl font-black text-white">Listening…</h1>
        <p className="text-slate-400 mt-1">Room <span className="text-cyan-400 font-bold">{roomId}</span></p>
      </div>
      {activeSpeakers.size > 0 && (
        <p className="text-green-400 text-sm font-semibold">
          🎙️ {activeSpeakers.size} speaking
        </p>
      )}
    </div>
  )
}
