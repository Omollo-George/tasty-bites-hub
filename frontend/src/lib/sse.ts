type EventSourceHandler = (event: MessageEvent) => void

type SseOptions = {
  onmessage: EventSourceHandler
  onopen?: (event: Event) => void
  onerror?: (event: Event) => void
  retryDelayMs?: number
}

export function createSse(url: string, options: SseOptions) {
  let eventSource: EventSource | null = null
  let retryTimeout: number | null = null

  const open = () => {
    if (eventSource) return
    try {
      eventSource = new EventSource(url)
      eventSource.onopen = (event) => {
        if (options.onopen) options.onopen(event)
      }
      eventSource.onmessage = (event) => {
        options.onmessage(event)
      }
      eventSource.onerror = (event) => {
        console.error('[SSE] connection error, retrying in', options.retryDelayMs ?? 3000, 'ms', event)
        if (options.onerror) options.onerror(event)
        if (eventSource) {
          eventSource.close()
          eventSource = null
        }
        if (retryTimeout !== null) window.clearTimeout(retryTimeout)
        retryTimeout = window.setTimeout(() => {
          retryTimeout = null
          open()
        }, options.retryDelayMs ?? 3000)
      }
    } catch (err) {
      console.error('[SSE] failed to open', err)
      if (retryTimeout !== null) window.clearTimeout(retryTimeout)
      retryTimeout = window.setTimeout(open, options.retryDelayMs ?? 3000)
    }
  }

  open()

  return {
    close: () => {
      if (retryTimeout !== null) {
        window.clearTimeout(retryTimeout)
        retryTimeout = null
      }
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
    },
  }
}
