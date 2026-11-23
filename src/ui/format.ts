export const numberLabel = (number: number) => String(number).padStart(2, '0')
export const paymentLabel = (payment: 'cash' | 'annuity') =>
  payment === 'cash' ? 'Cash value' : '30 annual payments'

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
export const money = (cents: number) => dollars.format(cents / 100)
export const awardMoney = (cents: number) => money(cents).replace(/\.00$/, '')

const eastern = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York',
})
export const dateLabel = (iso: string) => `${eastern.format(new Date(iso))} ET`
