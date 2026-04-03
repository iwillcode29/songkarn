import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
]

export function useVoiceChat({ roomId, peerId, micEnabled, playAudio = true }) {
  const channelRef = useRef(null)
  const streamRef = useRef(null)
  const outPcsRef = useRef(new Map())       // connections where WE send audio
  const inPcsRef = useRef(new Map())        // connections where WE receive audio
  const audiosRef = useRef(new Map())
  const pendingIceRef = useRef(new Map())   // buffered ICE candidates before remote desc is set
  const [micActive, setMicActive] = useState(false)
  const [activeSpeakers, setActiveSpeakers] = useState(new Set())

  const cleanupIn = useCallback((pid) => {
    inPcsRef.current.get(pid)?.close()
    inPcsRef.current.delete(pid)
    pendingIceRef.current.delete(pid)
    const a = audiosRef.current.get(pid)
    if (a) { a.pause(); a.srcObject = null; a.remove(); audiosRef.current.delete(pid) }
    setActiveSpeakers((prev) => { const s = new Set(prev); s.delete(pid); return s })
  }, [])

  const cleanupOut = useCallback((pid) => {
    outPcsRef.current.get(pid)?.close()
    outPcsRef.current.delete(pid)
  }, [])

  // ── Channel: always subscribe for receiving ──
  useEffect(() => {
    if (!roomId || !peerId) return

    const channel = supabase.channel(`voice:${roomId}`, {
      config: { broadcast: { self: false } },
    })

    // Someone announced they have mic — we request a connection from them
    channel.on('broadcast', { event: 'v-announce' }, ({ payload }) => {
      if (!payload || payload.from === peerId) return
      channel.send({ type: 'broadcast', event: 'v-request',
        payload: { from: peerId, to: payload.from } })
    })

    // New peer joined — if we have mic on, re-announce so they know to request from us
    channel.on('broadcast', { event: 'v-hello' }, ({ payload }) => {
      if (!payload || payload.from === peerId) return
      if (streamRef.current) {
        channel.send({ type: 'broadcast', event: 'v-announce', payload: { from: peerId } })
      }
    })

    // Someone is requesting we send audio to them (we must have mic on)
    channel.on('broadcast', { event: 'v-request' }, ({ payload }) => {
      if (!payload || payload.to !== peerId || !streamRef.current) return
      sendOfferTo(channel, peerId, payload.from, streamRef.current)
    })

    // Incoming offer — someone is sending audio TO us
    channel.on('broadcast', { event: 'v-offer' }, async ({ payload }) => {
      if (!payload || payload.to !== peerId) return
      const { from: senderId, offer } = payload
      cleanupIn(senderId)

      try {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
        inPcsRef.current.set(senderId, pc)

        pc.ontrack = (e) => {
          if (playAudio) {
            // Clean up any existing audio element for this sender before creating a new one
            const existing = audiosRef.current.get(senderId)
            if (existing) { existing.pause(); existing.srcObject = null; existing.remove() }

            const audio = document.createElement('audio')
            audio.autoplay = true
            audio.playsInline = true
            audio.srcObject = e.streams[0]
            document.body.appendChild(audio)
            audio.play().catch((err) => {
              console.warn('voice: audio play blocked (autoplay policy):', err)
              // Retry on next user interaction
              const resume = () => { audio.play().catch(() => {}); document.removeEventListener('click', resume); document.removeEventListener('touchend', resume) }
              document.addEventListener('click', resume, { once: true })
              document.addEventListener('touchend', resume, { once: true })
            })
            audiosRef.current.set(senderId, audio)
          }
          setActiveSpeakers((prev) => new Set(prev).add(senderId))
        }
        pc.onicecandidate = (e) => {
          if (e.candidate) channel.send({ type: 'broadcast', event: 'v-ice',
            payload: { from: peerId, to: senderId, candidate: e.candidate.toJSON() } })
        }
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') cleanupIn(senderId)
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer))

        // Drain any ICE candidates that arrived before remote description was set
        const pending = pendingIceRef.current.get(senderId) ?? []
        pendingIceRef.current.delete(senderId)
        for (const candidate of pending) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
        }

        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        channel.send({ type: 'broadcast', event: 'v-answer',
          payload: { from: peerId, to: senderId, answer: pc.localDescription.toJSON() } })
      } catch (e) {
        console.error('voice: offer failed from', senderId, e)
        cleanupIn(senderId)
      }
    })

    // Answer to our outgoing offer
    channel.on('broadcast', { event: 'v-answer' }, async ({ payload }) => {
      if (!payload || payload.to !== peerId) return
      const pc = outPcsRef.current.get(payload.from)
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.answer)).catch(() => {})
    })

    // ICE candidates — buffer if PC not ready yet
    channel.on('broadcast', { event: 'v-ice' }, async ({ payload }) => {
      if (!payload || payload.to !== peerId) return
      const { from: senderId, candidate } = payload

      const outPc = outPcsRef.current.get(senderId)
      if (outPc) { await outPc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {}); return }

      const inPc = inPcsRef.current.get(senderId)
      if (inPc && inPc.remoteDescription) {
        await inPc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
      } else {
        // Buffer until after setRemoteDescription
        if (!pendingIceRef.current.has(senderId)) pendingIceRef.current.set(senderId, [])
        pendingIceRef.current.get(senderId).push(candidate)
      }
    })

    channel.subscribe(() => {
      channel.send({ type: 'broadcast', event: 'v-hello', payload: { from: peerId } })
    })
    channelRef.current = channel

    return () => {
      for (const pid of Array.from(inPcsRef.current.keys())) cleanupIn(pid)
      for (const pid of Array.from(outPcsRef.current.keys())) cleanupOut(pid)
      pendingIceRef.current.clear()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setMicActive(false)
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [roomId, peerId, cleanupIn, cleanupOut])

  // ── Mic toggle ──
  useEffect(() => {
    if (!micEnabled) {
      for (const pid of Array.from(outPcsRef.current.keys())) cleanupOut(pid)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setMicActive(false)
      return
    }

    let cancelled = false
    let reannounceInterval = null
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        setMicActive(true)
        channelRef.current?.send({ type: 'broadcast', event: 'v-announce', payload: { from: peerId } })

        // Periodically re-announce so late joiners don't miss the initial broadcast
        reannounceInterval = setInterval(() => {
          if (streamRef.current && channelRef.current) {
            channelRef.current.send({ type: 'broadcast', event: 'v-announce', payload: { from: peerId } })
          }
        }, 4000)
      } catch (e) {
        console.error('voice: mic denied', e)
        setMicActive(false)
      }
    }
    start()
    return () => {
      cancelled = true
      clearInterval(reannounceInterval)
    }
  }, [micEnabled, peerId, cleanupOut])

  function sendOfferTo(channel, fromId, toId, stream) {
    cleanupOut(toId)
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    outPcsRef.current.set(toId, pc)

    stream.getAudioTracks().forEach((t) => pc.addTrack(t, stream))

    pc.onicecandidate = (e) => {
      if (e.candidate) channel.send({ type: 'broadcast', event: 'v-ice',
        payload: { from: fromId, to: toId, candidate: e.candidate.toJSON() } })
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') cleanupOut(toId)
    }

    pc.createOffer().then(async (offer) => {
      await pc.setLocalDescription(offer)
      channel.send({ type: 'broadcast', event: 'v-offer',
        payload: { from: fromId, to: toId, offer: pc.localDescription.toJSON() } })
    }).catch(() => cleanupOut(toId))
  }

  return { micActive, activeSpeakers }
}
