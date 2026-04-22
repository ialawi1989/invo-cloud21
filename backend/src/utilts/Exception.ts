export class ValidationException extends  Error{
    constructor(message:string){
        super(message);
    }
}

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean; // Indicates if this is an expected, operational error

    constructor(message: string, statusCode: number, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor); // Captures stack trace
    }
}

export class UnbalancedJournalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnbalancedJournalError";
  }
}