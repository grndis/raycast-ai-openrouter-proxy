export class HttpError extends Error {
  readonly status: number;
  readonly message: string;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.message = message;
  }
}
