/**
 * ====================================================================
 * UTILIDAD: APP ERROR
 * ====================================================================
 * Extiende la clase nativa Error para incluir códigos de estado HTTP
 * y facilitar el manejo de excepciones en el middleware global.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number) 
  {
    super(message); // Llama al constructor de la clase padre (Error)

    this.statusCode = statusCode;

    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}