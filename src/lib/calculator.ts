// Calculator logic utilities
import { CalculatorState, CalculatorOperation, MemoryOperation, CalculationHistory } from '@/types';

export class CalculatorEngine {
  private state: CalculatorState;

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): CalculatorState {
    return {
      display: '0',
      previousValue: null,
      operation: null,
      waitingForNewValue: false,
      memory: 0,
      history: []
    };
  }

  public getState(): CalculatorState {
    return { ...this.state };
  }

  public clear(): CalculatorState {
    this.state = this.getInitialState();
    return this.getState();
  }

  public clearEntry(): CalculatorState {
    this.state.display = '0';
    this.state.waitingForNewValue = false;
    return this.getState();
  }

  public inputDigit(digit: string): CalculatorState {
    if (this.state.waitingForNewValue) {
      this.state.display = digit;
      this.state.waitingForNewValue = false;
    } else {
      this.state.display = this.state.display === '0' ? digit : this.state.display + digit;
    }
    return this.getState();
  }

  public inputDecimal(): CalculatorState {
    if (this.state.waitingForNewValue) {
      this.state.display = '0.';
      this.state.waitingForNewValue = false;
    } else if (this.state.display.indexOf('.') === -1) {
      this.state.display += '.';
    }
    return this.getState();
  }

  public performOperation(operation: CalculatorOperation): CalculatorState {
    const current = parseFloat(this.state.display);

    if (this.state.previousValue === null) {
      this.state.previousValue = current;
    } else if (this.state.operation && !this.state.waitingForNewValue) {
      const result = this.calculate(this.state.previousValue, current, this.state.operation);
      
      // Add to history
      this.addToHistory(
        `${this.state.previousValue} ${this.getOperationSymbol(this.state.operation)} ${current}`,
        result.toString()
      );

      this.state.display = result.toString();
      this.state.previousValue = result;
    }

    if (operation === 'equals') {
      this.state.previousValue = null;
      this.state.operation = null;
      this.state.waitingForNewValue = true;
    } else {
      this.state.operation = operation;
      this.state.waitingForNewValue = true;
    }

    return this.getState();
  }

  public performScientificOperation(operation: CalculatorOperation): CalculatorState {
    const current = parseFloat(this.state.display);
    let result: number;

    try {
      switch (operation) {
        case 'sin':
          result = Math.sin(this.toRadians(current));
          break;
        case 'cos':
          result = Math.cos(this.toRadians(current));
          break;
        case 'tan':
          result = Math.tan(this.toRadians(current));
          break;
        case 'log':
          result = Math.log10(current);
          break;
        case 'ln':
          result = Math.log(current);
          break;
        case 'sqrt':
          result = Math.sqrt(current);
          break;
        case 'square':
          result = current * current;
          break;
        case 'percent':
          result = current / 100;
          break;
        case 'negate':
          result = -current;
          break;
        default:
          throw new Error('Unknown scientific operation');
      }

      // Add to history
      this.addToHistory(`${operation}(${current})`, result.toString());
      
      this.state.display = this.formatResult(result);
      this.state.waitingForNewValue = true;
    } catch (error) {
      this.state.display = 'Error';
      this.state.waitingForNewValue = true;
    }

    return this.getState();
  }

  public performMemoryOperation(operation: MemoryOperation): CalculatorState {
    const current = parseFloat(this.state.display);

    switch (operation) {
      case 'clear':
        this.state.memory = 0;
        break;
      case 'recall':
        this.state.display = this.state.memory.toString();
        this.state.waitingForNewValue = true;
        break;
      case 'add':
        this.state.memory += current;
        break;
      case 'subtract':
        this.state.memory -= current;
        break;
      case 'store':
        this.state.memory = current;
        break;
    }

    return this.getState();
  }

  private calculate(first: number, second: number, operation: string): number {
    switch (operation) {
      case 'add':
        return first + second;
      case 'subtract':
        return first - second;
      case 'multiply':
        return first * second;
      case 'divide':
        if (second === 0) throw new Error('Division by zero');
        return first / second;
      case 'power':
        return Math.pow(first, second);
      default:
        return second;
    }
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private formatResult(result: number): string {
    if (isNaN(result) || !isFinite(result)) {
      return 'Error';
    }
    
    // Format large numbers in scientific notation
    if (Math.abs(result) >= 1e10 || (Math.abs(result) < 1e-6 && result !== 0)) {
      return result.toExponential(6);
    }
    
    // Format with appropriate decimal places
    const formatted = parseFloat(result.toPrecision(12));
    return formatted.toString();
  }

  private getOperationSymbol(operation: string): string {
    switch (operation) {
      case 'add': return '+';
      case 'subtract': return '−';
      case 'multiply': return '×';
      case 'divide': return '÷';
      case 'power': return '^';
      default: return operation;
    }
  }

  private addToHistory(expression: string, result: string): void {
    const historyItem: CalculationHistory = {
      id: Date.now().toString(),
      expression,
      result,
      timestamp: new Date()
    };

    this.state.history.unshift(historyItem);
    
    // Keep only last 50 calculations
    if (this.state.history.length > 50) {
      this.state.history = this.state.history.slice(0, 50);
    }
  }

  public getHistory(): CalculationHistory[] {
    return [...this.state.history];
  }

  public clearHistory(): CalculatorState {
    this.state.history = [];
    return this.getState();
  }
}

// Export singleton instance
export const calculatorEngine = new CalculatorEngine();