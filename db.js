import Dexie from 'dexie'

const db = new Dexie('OPTCGManager')

db.version(1).stores({
  cards: 'id, name, cardNumber, set, color, type, cost, power, affiliation',
  catalog: '++id, cardId, condition, location, locationId, locationName',
  decks: '++id, name, leaderId, createdAt',
  deckCards: '++id, deckId, cardId, quantity',
  vaults: '++id, name, description, createdAt',
  vaultCards: '++id, vaultId, cardId, quantity',
  settings: 'key'
})

export default db
