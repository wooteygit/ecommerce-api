class Error {
    message?: string;
    code?: number;
}

export class ErrorModel {
    error: Error = new Error();

    constructor(message: string, code?: number) {
        this.error.message = message;
    }
}