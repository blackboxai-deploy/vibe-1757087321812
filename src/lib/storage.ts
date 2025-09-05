// IndexedDB storage utilities for secret vault
import { VaultFile, PinConfig, VaultSession } from '@/types';
import { encryptionManager } from './encryption';

export class VaultStorage {
  private dbName = 'SecretVaultDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initializeDB();
  }

  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Files object store
        if (!db.objectStoreNames.contains('files')) {
          const filesStore = db.createObjectStore('files', { keyPath: 'id' });
          filesStore.createIndex('name', 'name', { unique: false });
          filesStore.createIndex('type', 'type', { unique: false });
          filesStore.createIndex('uploadDate', 'uploadDate', { unique: false });
          filesStore.createIndex('category', 'category', { unique: false });
        }

        // PIN configuration object store
        if (!db.objectStoreNames.contains('pinConfig')) {
          db.createObjectStore('pinConfig', { keyPath: 'id' });
        }

        // Sessions object store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionsStore.createIndex('startTime', 'startTime', { unique: false });
        }

        // Metadata object store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initializeDB();
    }
    if (!this.db) {
      throw new Error('Failed to initialize database');
    }
    return this.db;
  }

  // File operations
  public async storeFile(file: VaultFile): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      
      const request = store.put(file);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getFile(fileId: string): Promise<VaultFile | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      
      const request = store.get(fileId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  public async getAllFiles(): Promise<VaultFile[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteFile(fileId: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      
      const request = store.delete(fileId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async searchFiles(query: string): Promise<VaultFile[]> {
    const allFiles = await this.getAllFiles();
    const lowercaseQuery = query.toLowerCase();
    
    return allFiles.filter(file => 
      file.name.toLowerCase().includes(lowercaseQuery) ||
      file.type.toLowerCase().includes(lowercaseQuery) ||
      (file.category && file.category.toLowerCase().includes(lowercaseQuery))
    );
  }

  public async getFilesByCategory(category: string): Promise<VaultFile[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const index = store.index('category');
      
      const request = index.getAll(category);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // PIN configuration operations
  public async storePinConfig(config: PinConfig): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['pinConfig'], 'readwrite');
      const store = transaction.objectStore('pinConfig');
      
      const configWithId = { ...config, id: 'main' };
      const request = store.put(configWithId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getPinConfig(): Promise<PinConfig | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['pinConfig'], 'readonly');
      const store = transaction.objectStore('pinConfig');
      
      const request = store.get('main');
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          const { id, ...config } = result;
          resolve(config);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Session management
  public async createSession(): Promise<VaultSession> {
    const session: VaultSession = {
      id: encryptionManager.generateSecureId(),
      startTime: new Date(),
      lastActivity: new Date(),
      isActive: true
    };

    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      
      const request = store.put(session);
      request.onsuccess = () => resolve(session);
      request.onerror = () => reject(request.error);
    });
  }

  public async updateSessionActivity(sessionId: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      
      const getRequest = store.get(sessionId);
      getRequest.onsuccess = () => {
        const session = getRequest.result;
        if (session) {
          session.lastActivity = new Date();
          const putRequest = store.put(session);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('Session not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  public async endSession(sessionId: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      
      const getRequest = store.get(sessionId);
      getRequest.onsuccess = () => {
        const session = getRequest.result;
        if (session) {
          session.isActive = false;
          const putRequest = store.put(session);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve(); // Session doesn't exist, consider it ended
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  public async cleanupExpiredSessions(timeoutMinutes: number): Promise<void> {
    const db = await this.ensureDB();
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const index = store.index('startTime');
      
      const request = index.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const session = cursor.value;
          if (session.lastActivity < cutoffTime) {
            session.isActive = false;
            cursor.update(session);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Metadata operations
  public async setMetadata(key: string, value: any): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['metadata'], 'readwrite');
      const store = transaction.objectStore('metadata');
      
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getMetadata(key: string): Promise<any> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Database operations
  public async clearAllData(): Promise<void> {
    const db = await this.ensureDB();
    const stores = ['files', 'pinConfig', 'sessions', 'metadata'];
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(stores, 'readwrite');
      let completed = 0;
      
      const onStoreCleared = () => {
        completed++;
        if (completed === stores.length) {
          resolve();
        }
      };
      
      stores.forEach(storeName => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = onStoreCleared;
        request.onerror = () => reject(request.error);
      });
    });
  }

  public async exportData(): Promise<any> {
    const [files, pinConfig, metadata] = await Promise.all([
      this.getAllFiles(),
      this.getPinConfig(),
      this.getMetadata('vaultSettings')
    ]);

    return {
      files,
      pinConfig,
      metadata,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  }

  public async getStorageUsage(): Promise<{
    totalFiles: number;
    totalSize: number;
    sizeByType: Record<string, number>;
  }> {
    const files = await this.getAllFiles();
    
    const usage = {
      totalFiles: files.length,
      totalSize: 0,
      sizeByType: {} as Record<string, number>
    };

    files.forEach(file => {
      usage.totalSize += file.size;
      
      const type = file.type.split('/')[0] || 'unknown';
      usage.sizeByType[type] = (usage.sizeByType[type] || 0) + file.size;
    });

    return usage;
  }
}

// Export singleton instance
export const vaultStorage = new VaultStorage();