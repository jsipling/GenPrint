/**
 * User Generator Storage
 * Manages persistence of user-created generators using IndexedDB
 */
import type { UserGeneratorDef, UserGeneratorSummary } from './userGeneratorTypes'

const DB_NAME = 'genprint-user-generators'
const DB_VERSION = 1
const STORE_NAME = 'generators'

/**
 * Open the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open user generators database'))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('name', 'name', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
    }
  })
}

/**
 * User generator storage operations
 */
export const userGeneratorStore = {
  /**
   * Save a user generator
   * Creates new if id doesn't exist, updates if it does
   */
  async save(generator: UserGeneratorDef): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      const request = store.put({
        ...generator,
        updatedAt: new Date().toISOString()
      })

      request.onerror = () => {
        reject(new Error('Failed to save generator'))
      }

      request.onsuccess = () => {
        resolve()
      }

      transaction.oncomplete = () => {
        db.close()
      }
    })
  },

  /**
   * Load a user generator by ID
   */
  async load(id: string): Promise<UserGeneratorDef | null> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onerror = () => {
        reject(new Error('Failed to load generator'))
      }

      request.onsuccess = () => {
        resolve(request.result ?? null)
      }

      transaction.oncomplete = () => {
        db.close()
      }
    })
  },

  /**
   * List all user generators (summary info only)
   */
  async list(): Promise<UserGeneratorSummary[]> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onerror = () => {
        reject(new Error('Failed to list generators'))
      }

      request.onsuccess = () => {
        const generators: UserGeneratorDef[] = request.result
        const summaries: UserGeneratorSummary[] = generators.map(g => ({
          id: g.id,
          name: g.name,
          description: g.description,
          createdAt: g.createdAt,
          updatedAt: g.updatedAt,
          source: g.source
        }))
        // Sort by updatedAt descending (most recent first)
        summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        resolve(summaries)
      }

      transaction.oncomplete = () => {
        db.close()
      }
    })
  },

  /**
   * Delete a user generator by ID
   */
  async delete(id: string): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onerror = () => {
        reject(new Error('Failed to delete generator'))
      }

      request.onsuccess = () => {
        resolve()
      }

      transaction.oncomplete = () => {
        db.close()
      }
    })
  },

  /**
   * Check if a generator exists
   */
  async exists(id: string): Promise<boolean> {
    const generator = await this.load(id)
    return generator !== null
  },

  /**
   * Generate a unique ID for a new generator
   */
  generateId(): string {
    return `user-gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },

  /**
   * Create a new generator with default values
   */
  createNew(name: string, description: string = ''): UserGeneratorDef {
    const now = new Date().toISOString()
    return {
      id: this.generateId(),
      name,
      description,
      parameters: [],
      builderCode: `// Your geometry code here
const base = box(50, 30, 10)
return base.build()`,
      createdAt: now,
      updatedAt: now,
      source: 'manual',
      version: 1
    }
  },

  /**
   * Duplicate an existing generator
   */
  async duplicate(id: string): Promise<UserGeneratorDef | null> {
    const original = await this.load(id)
    if (!original) {
      return null
    }

    const now = new Date().toISOString()
    const copy: UserGeneratorDef = {
      ...original,
      id: this.generateId(),
      name: `${original.name} (Copy)`,
      createdAt: now,
      updatedAt: now
    }

    await this.save(copy)
    return copy
  },

  /**
   * Export a generator to JSON
   */
  async exportToJson(id: string): Promise<string | null> {
    const generator = await this.load(id)
    if (!generator) {
      return null
    }
    return JSON.stringify(generator, null, 2)
  },

  /**
   * Import a generator from JSON
   */
  async importFromJson(json: string): Promise<UserGeneratorDef> {
    const parsed = JSON.parse(json) as UserGeneratorDef

    // Generate new ID to avoid conflicts
    const now = new Date().toISOString()
    const imported: UserGeneratorDef = {
      ...parsed,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    }

    await this.save(imported)
    return imported
  }
}
