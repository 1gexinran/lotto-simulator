import { useEffect, useRef, useState } from 'react'
import { createStore, InvalidRound, type Command, type Round } from './index'

type Failure = { detail: string, retry: () => void, unreadable: boolean, operation: 'read' | 'write' }
const store = () => createStore(window.indexedDB)
type QueuedCommand = { command: Command, view: Round }

function sameView(left: Round, right: Round) {
  return left.id === right.id && left.phase === right.phase && left.game === right.game &&
    (!left.game || left.drafts[left.game].active === right.drafts[left.game].active)
}

export function useRound() {
  const backend = useRef<ReturnType<typeof store> | undefined>(undefined)
  const database = () => (backend.current ??= store())
  const [round, setRound] = useState<Round>()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<Failure>()
  const [notice, setNotice] = useState('')
  const [printingId, setPrintingId] = useState<string>()
  const current = useRef<Round | undefined>(undefined)
  const channel = useRef<BroadcastChannel | undefined>(undefined)
  const locked = useRef(false)
  const needsSync = useRef(false)
  const queue = useRef<QueuedCommand[]>([])

  function adopt(next: Round) {
    if (current.current?.id === next.id && current.current.revision >= next.revision) return
    current.current = next
    setRound(next)
    if (next.atChooser) setPrintingId(undefined)
    return true
  }

  function report(error: unknown, retry: () => void, operation: Failure['operation'] = 'write') {
    setFailure({
      detail: error instanceof Error ? error.message : 'Browser storage could not be accessed.',
      retry, unreadable: error instanceof InvalidRound, operation,
    })
  }

  async function synchronize() {
    if (locked.current) {
      needsSync.current = true
      return
    }
    const previous = current.current
    try {
      const latest = await database().read()
      if (locked.current) {
        needsSync.current = true
        return
      }
      if (current.current === previous) {
        const changed = adopt(latest)
        setFailure(error => changed || error?.operation === 'read' ? undefined : error)
      }
    } catch (error) {
      if (locked.current) needsSync.current = true
      else if (current.current === previous) report(error, synchronize, 'read')
    }
  }

  function release() {
    locked.current = false
    setBusy(false)
    if (needsSync.current) {
      needsSync.current = false
      void synchronize()
    }
  }

  async function restore(replace = false) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    try {
      const next = await (replace ? database().replaceUnreadable() : database().restore())
      adopt(next)
      setFailure(undefined)
      channel.current?.postMessage('round changed')
    } catch (error) {
      report(error, () => void restore(replace))
    } finally {
      release()
    }
  }

  async function send(command: Command, expected = current.current) {
    if (!expected) return
    if (locked.current) {
      if (command.type === 'chooser' || expected.phase === 'edit' || expected.phase === 'review') {
        queue.current.push({ command, view: expected })
      }
      return
    }
    locked.current = true
    setBusy(true)
    setNotice('')
    setFailure(undefined)
    let next: Command | undefined = command
    try {
      while (next) {
        const receipt = await database().dispatch(expected, next)
        adopt(receipt.round)
        if (receipt.outcome === 'stale') {
          setNotice('The round changed in another tab. Your latest saved plays are shown.')
          break
        }
        if (receipt.outcome === 'applied') {
          if (next.type === 'confirm') setPrintingId(receipt.round.ticket?.id)
          channel.current?.postMessage('round changed')
        }
        expected = receipt.round
        next = undefined
        while (queue.current.length && !next) {
          const queued = queue.current.shift()!
          const sameRoundHome = queued.command.type === 'chooser' && queued.view.id === expected.id
          if (sameRoundHome || sameView(queued.view, expected)) next = queued.command
        }
      }
    } catch (error) {
      const retryCommand = next
      const retryRound = expected
      if (retryCommand) report(error, () => void send(retryCommand, retryRound))
    } finally {
      queue.current = []
      release()
    }
  }

  useEffect(() => {
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel('live-lotto-round')
      channel.current.onmessage = () => { void synchronize() }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && current.current) void synchronize()
    }
    document.addEventListener('visibilitychange', onVisible)
    void restore()
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      channel.current?.close()
    }
  }, [])

  return {
    round, busy, failure, notice, printingId, send: (command: Command) => send(command, round),
    replaceUnreadable: () => void restore(true),
  }
}
