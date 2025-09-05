'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { PinSetup } from './PinSetup';
import { FileManager } from './FileManager';
import { vaultStorage } from '@/lib/storage';
import { encryptionManager } from '@/lib/encryption';
import { VaultFile, PinConfig, VaultSession } from '@/types';

interface SecretVaultProps {
  onClose: () => void;
}

export function SecretVault({ onClose }: SecretVaultProps) {
  const [pinConfig, setPinConfig] = useState<PinConfig | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [currentSession, setCurrentSession] = useState<VaultSession | null>(null);

  useEffect(() => {
    initializeVault();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (isLockedOut && lockoutTime > 0) {
      interval = setInterval(() => {
        setLockoutTime(prev => {
          if (prev <= 1) {
            setIsLockedOut(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLockedOut, lockoutTime]);

  const initializeVault = async () => {
    try {
      const config = await vaultStorage.getPinConfig();
      setPinConfig(config);
      
      if (config) {
        // Check if locked out
        if (config.lockoutUntil && new Date() < config.lockoutUntil) {
          const remainingTime = Math.ceil((config.lockoutUntil.getTime() - Date.now()) / 1000);
          setIsLockedOut(true);
          setLockoutTime(remainingTime);
        }
        setAttempts(config.attempts || 0);
      }
    } catch (error) {
      console.error('Failed to initialize vault:', error);
      setError('Failed to initialize vault');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSetup = async (newPin: string) => {
    try {
      const hashedPin = await encryptionManager.hashPin(newPin);
      const newConfig: PinConfig = {
        hash: hashedPin,
        attempts: 0,
        lockoutUntil: null,
        isFirstTime: false
      };
      
      await vaultStorage.storePinConfig(newConfig);
      setPinConfig(newConfig);
      setCurrentPin(newPin);
      
      // Create session and unlock
      const session = await vaultStorage.createSession();
      setCurrentSession(session);
      setIsUnlocked(true);
      
      // Load files
      const vaultFiles = await vaultStorage.getAllFiles();
      setFiles(vaultFiles);
    } catch (error) {
      console.error('Failed to setup PIN:', error);
      setError('Failed to setup PIN');
    }
  };

  const handlePinSubmit = async () => {
    if (!pinConfig || !currentPin) return;
    
    setError('');
    
    try {
      const isValid = await encryptionManager.verifyPin(currentPin, pinConfig.hash);
      
      if (isValid) {
        // Reset attempts
        const updatedConfig = { ...pinConfig, attempts: 0, lockoutUntil: null };
        await vaultStorage.storePinConfig(updatedConfig);
        setPinConfig(updatedConfig);
        
        // Create session and unlock
        const session = await vaultStorage.createSession();
        setCurrentSession(session);
        setIsUnlocked(true);
        
        // Load files
        const vaultFiles = await vaultStorage.getAllFiles();
        setFiles(vaultFiles);
      } else {
        // Increment attempts
        const newAttempts = (pinConfig.attempts || 0) + 1;
        let lockoutUntil = null;
        
        // Check if should be locked out (after 5 attempts)
        if (newAttempts >= 5) {
          lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minute lockout
          setIsLockedOut(true);
          setLockoutTime(15 * 60);
        }
        
        const updatedConfig = { ...pinConfig, attempts: newAttempts, lockoutUntil };
        await vaultStorage.storePinConfig(updatedConfig);
        setPinConfig(updatedConfig);
        setAttempts(newAttempts);
        
        setError(`Invalid PIN. ${5 - newAttempts} attempts remaining.`);
        setCurrentPin('');
      }
    } catch (error) {
      console.error('PIN verification failed:', error);
      setError('PIN verification failed');
    }
  };

  const handleClose = async () => {
    if (currentSession) {
      await vaultStorage.endSession(currentSession.id);
    }
    onClose();
  };

  const handleFileUpdate = (updatedFiles: VaultFile[]) => {
    setFiles(updatedFiles);
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Initializing Secure Vault...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isUnlocked) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Secret Vault</h1>
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="bg-green-500/20 text-green-200">
                  Unlocked
                </Badge>
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-200">
                  {files.length} Files
                </Badge>
              </div>
            </div>
            <Button
              onClick={handleClose}
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              Close Vault
            </Button>
          </div>

          <FileManager
            files={files}
            currentPin={currentPin}
            onFilesUpdate={handleFileUpdate}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
            Secret Vault
          </CardTitle>
          <p className="text-sm text-gray-600">
            {!pinConfig ? 'Setup your secure PIN to continue' : 'Enter your PIN to access the vault'}
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {!pinConfig ? (
            <PinSetup onPinSetup={handlePinSetup} />
          ) : (
            <div className="space-y-4">
              {isLockedOut ? (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">
                    Too many failed attempts. Vault locked for {formatTime(lockoutTime)}.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    <Input
                      type="password"
                      placeholder="Enter PIN"
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                      className="text-center text-lg tracking-widest"
                      maxLength={20}
                      disabled={isLockedOut}
                    />
                    
                    {attempts > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Attempts</span>
                          <span>{attempts}/5</span>
                        </div>
                        <Progress value={(attempts / 5) * 100} className="h-1" />
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handlePinSubmit}
                    disabled={!currentPin || isLockedOut}
                    className="w-full"
                  >
                    Unlock Vault
                  </Button>
                </>
              )}

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="pt-4 border-t">
                <Button
                  onClick={handleClose}
                  variant="ghost"
                  className="w-full text-gray-600"
                >
                  Back to Calculator
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}