const numberFormatter = new Intl.NumberFormat('en-US')
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
})

/**
 * Formats file counts and byte sizes consistently during SSR and hydration.
 * @param value - Number to format.
 * @returns An English-formatted number with digit grouping.
 */
export function formatNumber(value: number) {
  return numberFormatter.format(value)
}

/**
 * Formats file timestamps in UTC so server and browser render the same instant.
 * @param value - File creation timestamp.
 * @returns An English-formatted date and time with a UTC time-zone label.
 */
export function formatDateLong(value: Date) {
  return dateFormatter.format(value)
}
