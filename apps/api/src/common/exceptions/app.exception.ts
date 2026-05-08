export class AppException extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class DomainException extends AppException {
  constructor(errorCode: string, message: string) {
    super(422, errorCode, message);
  }
}

export class InfrastructureException extends AppException {
  constructor(errorCode: string, message: string) {
    super(503, errorCode, message);
  }
}
