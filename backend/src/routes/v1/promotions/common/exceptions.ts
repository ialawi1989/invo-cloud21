export class Exception extends Error {
  statusCode: number;
  data?: any;
  innerException?: Exception;

  constructor(
    message: string,
    data?: any,
    innerException?: Exception,
    statusCode: number = 500 // default, but can be overridden
  ) {
    super(message);
    this.name = this.constructor.name;
    this.data = data;
    this.innerException = innerException;
    this.statusCode = statusCode;

    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundException extends Exception {
  constructor(message: string, data?: any, innerException?: Exception) {
    super(message, data, innerException, 404);

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DuplicatesException extends Exception {
  constructor(message: string, data?: any, innerException?: Exception) {
    super(message, data, innerException, 404);

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ParameterException extends Exception {
  param: string;

  constructor(
    param: string,
    message: string,
    data?: any,
    innerException?: Exception,
    statusCode: number = 400 // default, but can be overridden
  ) {
    super(message, data, innerException, statusCode);
    this.param = param;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AggregateException extends Exception {
  innerExceptions: Exception[];

  constructor(
    innerExceptions: Exception[],
    message = "Multiple exceptions occurred",
    statusCode: number = 500 // still default to 500, but overridable
  ) {
    super(message, undefined, undefined, statusCode);
    this.innerExceptions = innerExceptions;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function ToException(error: any): Exception {
  if (error instanceof Exception) return error;
  if (error instanceof AggregateException) return error;

  return new Exception(error.message);
}
