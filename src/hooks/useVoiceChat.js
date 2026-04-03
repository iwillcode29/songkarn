import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

/**
 * Unified voice chat hook.
 *
 * - Channel always subscribes so this peer can RECEIVE audio from others.
 * - When `micEnabled` is true, captures mic and sends offers to all known peers.
 * - When someone announces (mic on), all existing peers request a connection.
 *
 * Flow:
 *   Sender enables mic → broadcasts `v-announce { from }`
 *   All listeners respond with `v-request { from, to: sender }`
 *   Sender creates RTCPeerConnection + sends `v-offer` to each requester
 *   Requester answers with `v-answer`
 *   Audio flows over WebRTC
 */
export function useVoiceChat({ roomId, peerId, micEnabled, playAudio = true }) {
  const channelRef = useRef(null)
  const streamRef = useRef(null)
  const outPcsRef = useRef(new Map())   // connections where WE send audio
  const inPcsRef = useRef(new Map())    // connections where WE receive audio
  const audiosRef = useRef(new Map())
  const [micActive, setMicActive] = useState(false)
  const [activeSpeakers, setActiveSpeakers] = useState(new Set())

  const cleanupIn = useCallback((pid) => {
    inPcsRef.current.get(pid)?.close(); inPcsRef.current.delete(pid)
    const a = audiosRef.current.get(pid)
    if (a) { a.pause(); a.srcObject = null; audiosRef.current.delete(pid) }
    setActiveSpeakers((prev) => { const s = new Set(prev); s.delete(pid); return s })
  }, [])

  const cleanupOut = useCallback((pid) => {
    outPcsRef.current.get(pid)?.close(); outPcsRef.current.delete(pid)
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
            const audio = new Audio()
            audio.srcObject = e.streams[0]
            audio.play().catch(() => {})
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

    // ICE candidates (for both in and out)
    channel.on('broadcast', { event: 'v-ice' }, async ({ payload }) => {
      if (!payload || payload.to !== peerId) return
      const pc = outPcsRef.current.get(payload.from) || inPcsRef.current.get(payload.from)
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {})
    })

    channel.subscribe()
    channelRef.current = channel

    return () => {
      for (const pid of inPcsRef.current.keys()) cleanupIn(pid)
      for (const pid of outPcsRef.current.keys()) cleanupOut(pid)
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
      // Stop mic and tear down outgoing connections
      for (const pid of outPcsRef.current.keys()) cleanupOut(pid)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setMicActive(false)
      return
    }

    let cancelled = false
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        setMicActive(true)

        // Announce — all listeners will respond with v-request
        channelRef.current?.send({ type: 'broadcast', event: 'v-announce', payload: { from: peerId } })
      } catch (e) {
        console.error('voice: mic denied', e)
        setMicActive(false)
      }
    }
    start()
    return () => { cancelled = true }
  }, [micEnabled, peerId, cleanupOut])

  // Helper: create outgoing peer connection to send our audio
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
