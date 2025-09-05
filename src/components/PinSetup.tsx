'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { PinValidator } from '@/lib/encryption';

interface PinSetupProps {
  onPinSetup: (pin: string) => Promise<void>;
}

export function PinSetup({ onPinSetup }: PinSetupProps) {
  const [step, setStep] = useState<'initial' | 'confirm'>('initial');
  const [initialPin, setInitialPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const validateAndProceed = () => {
    const validation = PinValidator.validatePin(initialPin);
    
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    
    setErrors([]);
    setStep('confirm');
  };

  const handleConfirmPin = async () => {
    if (initialPin !== confirmPin) {
      setErrors(['PINs do not match. Please try again.']);
      return;
    }
    
    setIsLoading(true);
    setErrors([]);
    
    try {
      await onPinSetup(initialPin);
    } catch (error) {
      setErrors(['Failed to setup PIN. Please try again.']);
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep('initial');
    setInitialPin('');
    setConfirmPin('');
    setErrors([]);
  };

  const generateSecurePin = () => {
    const securePin = PinValidator.generateSecurePin();
    setInitialPin(securePin);
    setErrors([]);
  };

  if (step === 'initial') {
    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Create Your Secure PIN
          </h3>
          <p className="text-sm text-gray-600">
            This PIN will protect your secret vault. Choose wisely!
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Enter PIN (4-20 digits)"
              value={initialPin}
              onChange={(e) => {
                setInitialPin(e.target.value.replace(/\D/g, '')); // Only digits
                setErrors([]);
              }}
              className="text-center text-lg tracking-widest"
              maxLength={20}
            />
            
            <div className="flex justify-center">
              <Button
                onClick={generateSecurePin}
                variant="ghost"
                size="sm"
                className="text-xs text-blue-600"
              >
                Generate Secure PIN
              </Button>
            </div>
          </div>

          <Button
            onClick={validateAndProceed}
            disabled={!initialPin}
            className="w-full"
          >
            Continue
          </Button>
        </div>

        {errors.length > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription>
              <ul className="space-y-1 text-red-700">
                {errors.map((error, index) => (
                  <li key={index} className="text-sm">• {error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h4 className="font-medium text-blue-900 mb-2">PIN Requirements:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 4-20 digits long</li>
              <li>• Numbers only</li>
              <li>• Avoid simple patterns (1234, 0000, etc.)</li>
              <li>• Use a PIN you can remember</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Confirm Your PIN
        </h3>
        <p className="text-sm text-gray-600">
          Re-enter your PIN to confirm and secure your vault
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <div className="text-center text-sm text-gray-500 mb-2">
            PIN Length: {initialPin.length} digits
          </div>
          
          <Input
            type="password"
            placeholder="Confirm PIN"
            value={confirmPin}
            onChange={(e) => {
              setConfirmPin(e.target.value.replace(/\D/g, '')); // Only digits
              setErrors([]);
            }}
            className="text-center text-lg tracking-widest"
            maxLength={initialPin.length}
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleReset}
            variant="outline"
            className="flex-1"
            disabled={isLoading}
          >
            Back
          </Button>
          <Button
            onClick={handleConfirmPin}
            disabled={!confirmPin || isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Setting up...
              </div>
            ) : (
              'Setup Vault'
            )}
          </Button>
        </div>
      </div>

      {errors.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription>
            <ul className="space-y-1 text-red-700">
              {errors.map((error, index) => (
                <li key={index} className="text-sm">• {error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-green-700">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <p className="text-sm font-medium">
              Your PIN is being encrypted with military-grade security
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}