import "server-only";
import { requireAdmin, type AdminContext, type AdminRole } from "@/lib/auth/admin";
import { handleError } from "@/lib/http";

type Params = Record<string, string>;
type Handler<P extends Params> = (ctx: { req: Request; admin: AdminContext; params: P; url: URL }) => Promise<Response>;

/**
 * Route admin con autorizzazione obbligatoria lato server.
 * `sessionParam`: nome del parametro che contiene l'id sessione (per gli operatori).
 */
export function adminRoute<P extends Params = Params>(minRole: AdminRole, handler: Handler<P>, opts: { sessionParam?: keyof P } = {}) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      const params = ctx?.params ? await ctx.params : ({} as P);
      const sessionId = opts.sessionParam ? (params[opts.sessionParam] as string) : undefined;
      const admin = await requireAdmin(minRole, { sessionId });
      return await handler({ req, admin, params, url: new URL(req.url) });
    } catch (e) {
      return handleError(e);
    }
  };
}
