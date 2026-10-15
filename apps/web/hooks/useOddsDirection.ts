import { useRef, useState, useEffect } from 'react'
import { cmp } from '@/lib/decimal'

const FLASH_DURATION = 1500

/**
 * Detects odds value changes and returns the movement direction.
 * Returns 'up' | 'down' for 1.5s after a change, then null.
 */
export function useOddsDirection(value: string): 'up' | 'down' | null {
  const prevRef = useRef(value)
  const [direction, setDirection] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = value
    if (prev === value || prev === '—' || value === '—') return

    try {
      const result = cmp(value, prev)
      if (result > 0) setDirection('up')
      else if (result < 0) setDirection('down')
    } catch {
      return
    }

    const timer = setTimeout(() => setDirection(null), FLASH_DURATION)
    return () => clearTimeout(timer)
  }, [value])

  return direction
}
