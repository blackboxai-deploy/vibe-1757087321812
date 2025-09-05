'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { calculatorEngine } from '@/lib/calculator';
import { CalculatorState, CalculatorOperation, MemoryOperation } from '@/types';
import { GestureDetector } from './GestureDetector';
import { SecretVault } from './SecretVault';

export function Calculator() {
  const [state, setState] = useState<CalculatorState>(calculatorEngine.getState());
  const [showHistory, setShowHistory] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [isScientificMode, setIsScientificMode] = useState(false);

  const updateState = useCallback(() => {
    setState(calculatorEngine.getState());
  }, []);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      event.preventDefault();
      
      const key = event.key;
      
      // Handle number input
      if (/[0-9]/.test(key)) {
        calculatorEngine.inputDigit(key);
        updateState();
      }
      // Handle decimal point
      else if (key === '.') {
        calculatorEngine.inputDecimal();
        updateState();
      }
      // Handle operations
      else if (key === '+') {
        calculatorEngine.performOperation('add');
        updateState();
      }
      else if (key === '-') {
        calculatorEngine.performOperation('subtract');
        updateState();
      }
      else if (key === '*') {
        calculatorEngine.performOperation('multiply');
        updateState();
      }
      else if (key === '/') {
        calculatorEngine.performOperation('divide');
        updateState();
      }
      else if (key === 'Enter' || key === '=') {
        calculatorEngine.performOperation('equals');
        updateState();
      }
      // Handle clear operations
      else if (key === 'Escape') {
        calculatorEngine.clear();
        updateState();
      }
      else if (key === 'Backspace') {
        calculatorEngine.clearEntry();
        updateState();
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    return () => document.removeEventListener('keydown', handleKeyboard);
  }, [updateState]);

  const handleDigit = (digit: string) => {
    calculatorEngine.inputDigit(digit);
    updateState();
  };

  const handleDecimal = () => {
    calculatorEngine.inputDecimal();
    updateState();
  };

  const handleOperation = (operation: CalculatorOperation) => {
    calculatorEngine.performOperation(operation);
    updateState();
  };

  const handleScientificOperation = (operation: CalculatorOperation) => {
    calculatorEngine.performScientificOperation(operation);
    updateState();
  };

  const handleMemoryOperation = (operation: MemoryOperation) => {
    calculatorEngine.performMemoryOperation(operation);
    updateState();
  };

  const handleClear = () => {
    calculatorEngine.clear();
    updateState();
  };

  const handleClearEntry = () => {
    calculatorEngine.clearEntry();
    updateState();
  };

  const onVaultActivated = () => {
    setShowVault(true);
  };

  const formatDisplay = (value: string): string => {
    if (value === 'Error' || value === 'Infinity' || value === '-Infinity') {
      return value;
    }
    
    // Add commas for thousands separator
    const parts = value.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  if (showVault) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
        <SecretVault onClose={() => setShowVault(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 flex items-center justify-center">
      <GestureDetector onVaultActivated={onVaultActivated}>
        <div className="w-full max-w-sm mx-auto">
          {/* Calculator Card */}
          <Card className="bg-white/95 backdrop-blur-sm shadow-2xl border-0 overflow-hidden">
            <CardContent className="p-0">
              {/* Display Section */}
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6">
                {/* Memory Indicator */}
                {state.memory !== 0 && (
                  <div className="flex justify-start mb-2">
                    <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-200">
                      M: {state.memory}
                    </Badge>
                  </div>
                )}
                
                {/* Main Display */}
                <div className="text-right">
                  <div className="text-4xl font-mono font-light tracking-wider min-h-[48px] flex items-center justify-end">
                    {formatDisplay(state.display)}
                  </div>
                  
                  {/* Operation Display */}
                  {state.operation && state.previousValue !== null && (
                    <div className="text-sm text-gray-400 mt-1">
                      {state.previousValue} {state.operation === 'add' ? '+' : 
                       state.operation === 'subtract' ? '−' : 
                       state.operation === 'multiply' ? '×' : 
                       state.operation === 'divide' ? '÷' : state.operation}
                    </div>
                  )}
                </div>
              </div>

              {/* Mode Toggles */}
              <div className="px-4 py-2 bg-gray-50 border-b flex justify-between items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsScientificMode(!isScientificMode)}
                  className="text-xs"
                >
                  {isScientificMode ? 'Basic' : 'Scientific'}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-xs"
                >
                  History
                </Button>
              </div>

              {/* History Panel */}
              {showHistory && (
                <div className="px-4 py-3 bg-gray-50 border-b max-h-32 overflow-y-auto">
                  <div className="space-y-1">
                    {state.history.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center">No history</p>
                    ) : (
                      state.history.slice(0, 5).map((item) => (
                        <div key={item.id} className="text-sm">
                          <div className="text-gray-600">{item.expression}</div>
                          <div className="text-gray-900 font-medium">= {item.result}</div>
                        </div>
                      ))
                    )}
                  </div>
                  {state.history.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        calculatorEngine.clearHistory();
                        updateState();
                      }}
                      className="w-full mt-2 text-xs text-red-600"
                    >
                      Clear History
                    </Button>
                  )}
                </div>
              )}

              {/* Scientific Functions Row */}
              {isScientificMode && (
                <div className="p-4 bg-gray-100 border-b">
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleScientificOperation('sin')}
                      className="text-xs font-medium"
                    >
                      sin
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleScientificOperation('cos')}
                      className="text-xs font-medium"
                    >
                      cos
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleScientificOperation('tan')}
                      className="text-xs font-medium"
                    >
                      tan
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleScientificOperation('log')}
                      className="text-xs font-medium"
                    >
                      log
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleScientificOperation('ln')}
                      className="text-xs font-medium"
                    >
                      ln
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleScientificOperation('sqrt')}
                      className="text-xs font-medium"
                    >
                      √
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleScientificOperation('square')}
                      className="text-xs font-medium"
                    >
                      x²
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOperation('power')}
                      className="text-xs font-medium"
                    >
                      x^y
                    </Button>
                  </div>
                </div>
              )}

              {/* Memory Functions Row */}
              <div className="p-4 border-b bg-gray-50">
                <div className="grid grid-cols-5 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMemoryOperation('clear')}
                    className="text-xs"
                  >
                    MC
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMemoryOperation('recall')}
                    className="text-xs"
                  >
                    MR
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMemoryOperation('add')}
                    className="text-xs"
                  >
                    M+
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMemoryOperation('subtract')}
                    className="text-xs"
                  >
                    M-
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMemoryOperation('store')}
                    className="text-xs"
                  >
                    MS
                  </Button>
                </div>
              </div>

              {/* Main Button Grid */}
              <div className="p-4">
                <div className="grid grid-cols-4 gap-3">
                  {/* Row 1 */}
                  <Button
                    variant="outline"
                    onClick={handleClear}
                    className="h-14 text-sm font-semibold text-red-600 border-red-200 hover:bg-red-50"
                  >
                    AC
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClearEntry}
                    className="h-14 text-sm font-semibold text-orange-600 border-orange-200 hover:bg-orange-50"
                  >
                    CE
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleScientificOperation('percent')}
                    className="h-14 text-sm font-semibold text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    %
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => handleOperation('divide')}
                    className="h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    ÷
                  </Button>

                  {/* Row 2 */}
                  <Button
                    variant="secondary"
                    onClick={() => handleDigit('7')}
                    className="h-14 text-lg font-semibold bg-white hover:bg-gray-50 text-gray-900 border"
                  >
                    7
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleDigit('8')}
                    className="h-14 text-lg font-semibold bg-white hover:bg-gray-50 text-gray-900 border"
                  >
                    8
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleDigit('9')}
                    className="h-14 text-lg font-semibold bg-white hover:bg-gray-50 text-gray-900 border"
                  >
                    9
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => handleOperation('multiply')}
                    className="h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    ×
                  </Button>

                  {/* Row 3 */}
                  <Button
                    variant="secondary"
                    onClick={() => handleDigit('4')}
                    className="h-14 text-lg font-semibold bg-white hover:bg-gray-50 text-gray-900 border"
                  >
                    4
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleDigit('5')}
                    className="h-14 text-lg font-semibold bg-white hover:bg-gray-50 text-gray-900 border"
                  >
                    5
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleDigit('6')}
                    className="h-14 text-lg font-semibold bg-white hover:bg-gray-50 text-gray-900 border"
                  >
                    6
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => handleOperation('subtract')}
                    className="h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    −
                  </Button>

                  {/* Row 4 */}
                  <Button
                    variant="secondary"
                    onClick={() => handleDigit('1')}
                    className="h-14 text-lg font-semibold bg-white hover:bg-gray-50 text-gray-900 border"
                  >
                    1
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleDigit('2')}
                    className="h-14 text-lg font-semibold bg-white hover:bg-gray-50 text-gray-900 border"
                  >
                    2
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleDigit('3')}
                    className="h-14 text-lg font-semibold bg-white hover:bg-gray-50 text-gray-900 border"
                  >
                    3
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => handleOperation('add')}
                    className="h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    +
                  </Button>

                  {/* Row 5 */}
                  <Button
                    variant="secondary"
                    onClick={() => handleScientificOperation('negate')}
                    className="h-14 text-sm font-semibold bg-white hover:bg-gray-50 text-gray-900 border"
                  >
                    +/−
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleDigit('0')}
                    className="h-14 text-lg font-semibold bg-white hover:bg-gray-50 text-gray-900 border"
                  >
                    0
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleDecimal}
                    className="h-14 text-lg font-semibold bg-white hover:bg-gray-50 text-gray-900 border"
                  >
                    .
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => handleOperation('equals')}
                    className="h-14 text-lg font-semibold bg-green-600 hover:bg-green-700 text-white"
                  >
                    =
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Gesture Instruction */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Draw a "V" shape to access secret vault
            </p>
          </div>
        </div>
      </GestureDetector>
    </div>
  );
}