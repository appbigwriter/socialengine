import type {FastifyInstance} from 'fastify';
import type {EngineDeps} from '../engine/types.ts';
import {registerSocialRoutes as oauthRoutes} from './oauth.ts';
import {registerMediaDelivery} from './delivery.ts';
import {reconcilePublication,collectPublicationMetrics} from './publishing.ts';
import {uuid} from '../security.ts';
export {OAuthFlow,OAuthTokens} from './oauth.ts';
export {socialCapabilities,assertCanPublish,publishDestination,publishRemote,reconcilePublication,collectPublicationMetrics} from './publishing.ts';
export async function registerSocialRoutes(app:FastifyInstance,deps:EngineDeps){
 await oauthRoutes(app,deps);registerMediaDelivery(app,deps);
 app.post<{Params:{id:string;publicationId:string}}>('/api/tenants/:id/publications/:publicationId/reconcile',async req=>({publication:await reconcilePublication(deps,await deps.scopeFor(req,['admin','publisher']),uuid(req.params.publicationId))}));
 app.post<{Params:{id:string;publicationId:string}}>('/api/tenants/:id/publications/:publicationId/metrics',async req=>({snapshot:await collectPublicationMetrics(deps,await deps.scopeFor(req,['admin','publisher']),uuid(req.params.publicationId))}));
}
