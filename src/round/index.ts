import { decode, InvalidRound } from './decode'
import { browserDependencies, freshRound, transition, type Command, type Round } from './model'

export { InvalidRound, type Round, type Command }

const DATABASE = 'live-lotto'
const COLLECTION = 'rounds'
const KEY = 'current'

type Stamp = Pick<Round, 'id' | 'revision' | 'ticket'>
type Receipt = { round: Round, outcome: 'applied' | 'already' | 'stale' | 'ignored' }

export function createStore(factory: IDBFactory, dependencies = browserDependencies) {
  let connection: Promise<IDBDatabase> | undefined
  function open() {
    if (!connection) {
      connection = new Promise<IDBDatabase>((resolve, reject) => {
        const request = factory.open(DATABASE, 1)
        request.onupgradeneeded = () => request.result.createObjectStore(COLLECTION)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const close = () => { db.close(); connection = undefined }
          db.onversionchange = close
          db.onclose = close
          resolve(db)
        }
      }).catch(error => {
        connection = undefined
        throw error
      })
    }
    return connection
  }

  async function transaction<T>(
    mode: 'readonly' | 'readwrite', operate: (record: unknown, save: (round: Round) => void) => T,
  ): Promise<T> {
    const db = await open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(COLLECTION, mode)
      const store = tx.objectStore(COLLECTION)
      const request = store.get(KEY)
      let result: T
      let failure: unknown
      tx.oncomplete = () => resolve(result)
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('Saving the round was interrupted.'))
      request.onsuccess = () => {
        try {
          result = operate(request.result, round => { store.put(round, KEY) })
        } catch (error) {
          failure = error
          tx.abort()
        }
      }
    })
  }

  return {
    read: () => transaction('readonly', decode),
    restore: () => transaction('readwrite', (raw, save) => {
      if (raw === undefined) {
        const round = freshRound(dependencies.identity)
        save(round)
        return round
      }
      const current = decode(raw)
      const complete = transition(current, { type: 'complete' }, dependencies)
      if (complete) save(complete)
      return complete ?? current
    }),
    replaceUnreadable: () => transaction('readwrite', (raw, save) => {
      try {
        return decode(raw)
      } catch (error) {
        if (!(error instanceof InvalidRound)) throw error
        const round = freshRound(dependencies.identity)
        save(round)
        return round
      }
    }),
    dispatch: (expected: Stamp, command: Command): Promise<Receipt> =>
      transaction('readwrite', (raw, save) => {
        const round = decode(raw)
        if (expected.id !== round.id) return { round, outcome: 'stale' }
        if ((command.type === 'confirm' && round.ticket) ||
          (command.type === 'start' && round.draw) ||
          (command.type === 'complete' && round.phase === 'complete')) return { round, outcome: 'already' }
        // Navigating home can preserve a newer draw on the same ticket.
        const sameTicketHome = command.type === 'chooser' && round.ticket && round.ticket.id === expected.ticket?.id
        if (round.revision !== expected.revision && !sameTicketHome) return { round, outcome: 'stale' }
        const next = transition(round, command, dependencies)
        if (!next) return { round, outcome: 'ignored' }
        save(next)
        return { round: next, outcome: 'applied' }
      }),
  }
}
