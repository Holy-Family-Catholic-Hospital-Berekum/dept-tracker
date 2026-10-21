// Keep these lists in sync with the validators in firestore.rules.
export const GHANA_CARD_PATTERN = /^GHA-\d{9}-\d$/
export const PHONE_PATTERN = /^\+?\d{9,15}$/

export const SCHEDULES = [
  ['Weekly', 'Weekly Installments'],
  ['Bi-Weekly', 'Bi-Weekly Installments'],
  ['Monthly', 'Monthly Installments'],
  ['Lump Sum', 'Single Due Date'],
]
export const METHODS = ['Cash', 'Mobile Money', 'Bank Transfer', 'Cheque']
export const PAYERS = ['Patient', 'Guarantor', 'Other']

export const cleanPhone = (v) => v.replace(/[\s-]/g, '')
