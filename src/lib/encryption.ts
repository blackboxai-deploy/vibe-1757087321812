// Encryption utilities for secret vault
import { PinConfig } from '@/types';

export class EncryptionManager {
  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();

  // Generate a key from PIN using PBKDF2
  public async generateKeyFromPin(pin: string, salt?: Uint8Array): Promise<{ key: CryptoKey; salt: Uint8Array }> {
    const encoder = new TextEncoder();
    const pinData = encoder.encode(pin);
    
    // Generate or use provided salt
    const keySalt = salt || crypto.getRandomValues(new Uint8Array(16));
    
    // Import PIN as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      pinData,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    // Derive key using PBKDF2
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: keySalt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    return { key, salt: keySalt };
  }

  // Encrypt file data
  public async encryptFile(fileData: ArrayBuffer, pin: string): Promise<{
    encryptedData: ArrayBuffer;
    salt: Uint8Array;
    iv: Uint8Array;
  }> {
    const { key, salt } = await this.generateKeyFromPin(pin);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
    
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      fileData
    );
    
    return { encryptedData, salt, iv };
  }

  // Decrypt file data
  public async decryptFile(
    encryptedData: ArrayBuffer,
    pin: string,
    salt: Uint8Array,
    iv: Uint8Array
  ): Promise<ArrayBuffer> {
    const { key } = await this.generateKeyFromPin(pin, salt);
    
    try {
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedData
      );
      
      return decryptedData;
    } catch (error) {
      throw new Error('Decryption failed - invalid PIN or corrupted data');
    }
  }

  // Hash PIN for storage (using Web Crypto API)
  public async hashPin(pin: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const { key } = await this.generateKeyFromPin(pin, salt);
    
    // Export key to get consistent hash
    const keyData = await crypto.subtle.exportKey('raw', key);
    const hashArray = new Uint8Array(keyData);
    
    // Combine salt and hash
    const combined = new Uint8Array(salt.length + hashArray.length);
    combined.set(salt);
    combined.set(hashArray, salt.length);
    
    // Convert to base64 for storage
    return this.arrayBufferToBase64(combined);
  }

  // Verify PIN against stored hash
  public async verifyPin(pin: string, storedHash: string): Promise<boolean> {
    try {
      const combined = this.base64ToArrayBuffer(storedHash);
      const salt = combined.slice(0, 16); // First 16 bytes are salt
      const storedKeyData = combined.slice(16); // Rest is key data
      
      const { key } = await this.generateKeyFromPin(pin, salt);
      const keyData = await crypto.subtle.exportKey('raw', key);
      
      // Compare key data
      const newKeyArray = new Uint8Array(keyData);
      const storedKeyArray = new Uint8Array(storedKeyData);
      
      if (newKeyArray.length !== storedKeyArray.length) {
        return false;
      }
      
      // Constant-time comparison
      let result = 0;
      for (let i = 0; i < newKeyArray.length; i++) {
        result |= newKeyArray[i] ^ storedKeyArray[i];
      }
      
      return result === 0;
    } catch (error) {
      return false;
    }
  }

  // Encrypt text data (for metadata, etc.)
  public async encryptText(text: string, pin: string): Promise<{
    encryptedText: string;
    salt: string;
    iv: string;
  }> {
    const textData = this.textEncoder.encode(text);
    const { encryptedData, salt, iv } = await this.encryptFile(textData.buffer, pin);
    
    return {
      encryptedText: this.arrayBufferToBase64(encryptedData),
      salt: this.arrayBufferToBase64(salt),
      iv: this.arrayBufferToBase64(iv)
    };
  }

  // Decrypt text data
  public async decryptText(
    encryptedText: string,
    pin: string,
    salt: string,
    iv: string
  ): Promise<string> {
    const encryptedData = this.base64ToArrayBuffer(encryptedText);
    const saltArray = this.base64ToArrayBuffer(salt);
    const ivArray = this.base64ToArrayBuffer(iv);
    
    const decryptedData = await this.decryptFile(
      encryptedData,
      pin,
      new Uint8Array(saltArray),
      new Uint8Array(ivArray)
    );
    
    return this.textDecoder.decode(decryptedData);
  }

  // Generate secure random ID
  public generateSecureId(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Convert ArrayBuffer to Base64
  public arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Convert Base64 to ArrayBuffer
  public base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Create encrypted backup of vault data
  public async createBackup(vaultData: any, pin: string): Promise<string> {
    const dataString = JSON.stringify(vaultData);
    const { encryptedText, salt, iv } = await this.encryptText(dataString, pin);
    
    const backup = {
      version: '1.0',
      timestamp: Date.now(),
      encrypted: encryptedText,
      salt,
      iv
    };
    
    return btoa(JSON.stringify(backup));
  }

  // Restore vault data from encrypted backup
  public async restoreFromBackup(backupString: string, pin: string): Promise<any> {
    try {
      const backup = JSON.parse(atob(backupString));
      
      if (!backup.version || !backup.encrypted) {
        throw new Error('Invalid backup format');
      }
      
      const decryptedData = await this.decryptText(
        backup.encrypted,
        pin,
        backup.salt,
        backup.iv
      );
      
      return JSON.parse(decryptedData);
    } catch (error) {
      throw new Error('Failed to restore backup - invalid data or wrong PIN');
    }
  }
}

// PIN validation utilities
export class PinValidator {
  public static validatePin(pin: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!pin || pin.length < 4) {
      errors.push('PIN must be at least 4 characters long');
    }
    
    if (pin.length > 20) {
      errors.push('PIN must be no more than 20 characters long');
    }
    
    if (!/^[0-9]+$/.test(pin)) {
      errors.push('PIN must contain only numbers');
    }
    
    // Check for common weak patterns
    if (this.isWeakPin(pin)) {
      errors.push('PIN is too weak - avoid simple patterns like 1234 or 0000');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private static isWeakPin(pin: string): boolean {
    // Common weak patterns
    const weakPatterns = [
      /^(.)\1+$/, // All same digits (0000, 1111, etc.)
      /^0123/, // Sequential ascending
      /^1234/,
      /^2345/,
      /^3456/,
      /^4567/,
      /^5678/,
      /^6789/,
      /^9876/, // Sequential descending
      /^8765/,
      /^7654/,
      /^6543/,
      /^5432/,
      /^4321/,
      /^3210/,
    ];
    
    return weakPatterns.some(pattern => pattern.test(pin));
  }

  public static generateSecurePin(): string {
    const digits = '0123456789';
    let pin = '';
    
    // Generate 6-digit PIN
    for (let i = 0; i < 6; i++) {
      const randomIndex = crypto.getRandomValues(new Uint8Array(1))[0] % digits.length;
      pin += digits[randomIndex];
    }
    
    // Ensure it's not weak
    if (this.isWeakPin(pin)) {
      return this.generateSecurePin(); // Retry if weak
    }
    
    return pin;
  }
}

// Export singleton instance
export const encryptionManager = new EncryptionManager();