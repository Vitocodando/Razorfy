import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { BusinessError } from './BusinessError';

const HTTP_STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
};

function errorBody(status: number, code: string, message: string, path: string) {
  return {
    timestamp: new Date().toISOString(),
    status,
    error: HTTP_STATUS_TEXT[status] ?? 'Error',
    code,
    message,
    path,
  };
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof BusinessError) {
    res.status(err.statusCode).json(errorBody(err.statusCode, err.code, err.message, req.path));
    return;
  }

  if (err instanceof ZodError) {
    const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    res.status(400).json(errorBody(400, 'INVALID_INPUT', message, req.path));
    return;
  }

  if (err && typeof err === 'object') {
    const pgErr = err as { code?: string; constraint?: string; meta?: { target?: string[] } };

    // Prisma embrulha violações de constraint em PrismaClientKnownRequestError (P2002 = unique)
    if (pgErr.code === 'P2002') {
      const target = pgErr.meta?.target ?? [];
      const code = target.includes('email') ? 'EMAIL_ALREADY_EXISTS'
        : target.includes('phone') ? 'PHONE_ALREADY_EXISTS'
        : 'DATA_CONFLICT';
      const message = target.includes('email') ? 'Este e-mail já está cadastrado.'
        : target.includes('phone') ? 'Este telefone já está cadastrado.'
        : 'Registro duplicado.';
      res.status(409).json(errorBody(409, code, message, req.path));
      return;
    }
    if (pgErr.code === '23P01' && pgErr.constraint === 'appointments_no_overlap') {
      res.status(409).json(errorBody(
        409,
        'SLOT_ALREADY_BOOKED',
        'O horário selecionado acabou de ser reservado. Por favor, escolha outra opção.',
        req.path,
      ));
      return;
    }
    if (pgErr.code === '23505') {
      res.status(409).json(errorBody(409, 'DATA_CONFLICT', 'Registro duplicado.', req.path));
      return;
    }
  }

  console.error('[error]', err);
  res.status(500).json(errorBody(500, 'INTERNAL_ERROR', 'Erro interno do servidor.', req.path));
}
