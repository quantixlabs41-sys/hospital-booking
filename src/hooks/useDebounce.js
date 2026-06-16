import { useState, useEffect } from 'react'

/**
 * Debounce hook for search inputs.
 * Per Priority 3 (debounce-throttle) — prevents query on every keystroke.
 *
 * @param {any} value - The value to debounce
 * @param {number} delay - Debounce delay in ms (default: 300)
 * @returns {any} The debounced value
 *
 * @example
 * const [search, setSearch] = useState('')
 * const debouncedSearch = useDebounce(search, 300)
 * useEffect(() => { fetchResults(debouncedSearch) }, [debouncedSearch])
 */
export default function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
