import type {Platform,PostData,RecordRow} from '../contracts.ts';
import {socialCapabilities,assertCanPublish} from '../social/index.ts';
export {socialCapabilities};
export const unavailable=(message:string)=>Object.assign(new Error(message),{statusCode:503,code:'INTEGRATION_UNAVAILABLE'});
export function requireApproved(post:RecordRow<PostData>,revision:number){if(post.revision!==revision||post.data.status!=='approved'||post.data.approvedRevision!==revision)throw Object.assign(new Error('Publicação exige a revisão atual aprovada.'),{statusCode:409});}
export function ensureSocialCapability(platform:Platform,format:string){const capability=socialCapabilities[platform];if(!capability)throw Object.assign(new Error('Rede inválida.'),{statusCode:422});if(!capability.formats.includes(format))throw Object.assign(new Error('Formato incompatível com esta rede; prepare e aprove uma adaptação.'),{statusCode:422});assertCanPublish(platform,format);}
