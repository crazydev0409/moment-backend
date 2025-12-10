import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

// Custom request handler type that allows returning Response objects
export type CustomRequestHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery, Locals>,
  res: Response<ResBody, Locals>,
  next?: NextFunction
) => void | Response | Promise<void | Response>;

// Helper function to convert CustomRequestHandler to standard RequestHandler
// This helps with type compatibility when used with Express router
export function asHandler(handler: CustomRequestHandler): RequestHandler {
  return handler as unknown as RequestHandler;
}
