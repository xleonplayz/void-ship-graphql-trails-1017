import http from 'node:http';
import {buildSchema, parse, validate, execute, getOperationAST, GraphQLError, version} from 'graphql';
import {trails} from './catalog.js';
import {RELEASE, BOOKING_FEE_CENTS} from './policy.js';
import {HTML, CLIENT} from './ui.js';

const schema=buildSchema(`
 enum Difficulty { EASY MEDIUM HARD }
 enum Region { NORD SUED WEST }
 type Guide { name: String!, languages: [String!]! }
 type Trail { id: ID!, name: String!, region: Region!, difficulty: Difficulty!, distanceKm: Float!, adultCents: Int!, childCents: Int!, guide: Guide!, stops: [String!]! }
 input PartyInput { trailId: ID!, adults: Int!, children: Int! = 0 }
 type Quote { trail: Trail!, adults: Int!, children: Int!, subtotalCents: Int!, feeCents: Int!, totalCents: Int!, release: Int! }
 type Query { release: Int!, trails(region: Region, difficulty: Difficulty): [Trail!]!, trail(id: ID!): Trail, quote(input: PartyInput!): Quote }
 type Mutation { calculateQuote(input: PartyInput!): Quote }
`);
function quote({input}) {
 const trail=trails.find(t=>t.id===input.trailId);
 if(!trail)throw new GraphQLError('Route not found',{extensions:{code:'NOT_FOUND'}});
 if(input.adults<1||input.adults>12||input.children<0||input.children>12||input.adults+input.children>12)
  throw new GraphQLError('Party requires 1–12 people and at least one adult',{extensions:{code:'BAD_USER_INPUT'}});
 const subtotalCents=input.adults*trail.adultCents+input.children*trail.childCents;
 return {trail,adults:input.adults,children:input.children,subtotalCents,feeCents:BOOKING_FEE_CENTS,totalCents:subtotalCents+BOOKING_FEE_CENTS,release:RELEASE};
}
const root={release:()=>RELEASE,trails:({region,difficulty})=>trails.filter(t=>(!region||t.region===region)&&(!difficulty||t.difficulty===difficulty)),trail:({id})=>trails.find(t=>t.id===id)||null,quote,calculateQuote:quote};
function send(res,status,body,type='application/json; charset=utf-8',headers={}) {
 res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-trails-release':String(RELEASE),...headers});
 res.end(typeof body==='string'?body:JSON.stringify(body));
}
function fail(res,status,message) {return send(res,status,{errors:[{message}]});}
async function readBody(req) {
 let size=0;const chunks=[];
 await new Promise((resolve,reject)=>{
  req.on('data',chunk=>{size+=chunk.length;if(size<=16384)chunks.push(chunk);});
  req.on('end',resolve);req.on('error',reject);
 });
 if(size>16384)throw new Error('Body exceeds 16 KiB');
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 try {
  if(url.pathname==='/'&&req.method==='GET')return send(res,200,HTML(RELEASE),'text/html; charset=utf-8');
  if(url.pathname==='/client.js'&&req.method==='GET')return send(res,200,CLIENT,'text/javascript; charset=utf-8');
  if(url.pathname==='/health'&&req.method==='GET')return send(res,200,{ok:true,release:RELEASE,feeCents:BOOKING_FEE_CENTS,graphql:version});
  if(url.pathname!=='/graphql')return fail(res,404,'Not found');
  if(req.method!=='GET'&&req.method!=='POST')return send(res,405,{errors:[{message:'GET or POST required'}]},undefined,{allow:'GET, POST'});
  let input;
  if(req.method==='GET') {
   input={query:url.searchParams.get('query'),variables:url.searchParams.has('variables')?JSON.parse(url.searchParams.get('variables')):undefined,operationName:url.searchParams.get('operationName')||undefined};
  } else {
   if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return fail(res,415,'Use application/json');
   input=await readBody(req);
  }
  if(!input||typeof input.query!=='string'||!input.query.trim()||input.query.length>4096)return fail(res,400,'Query must contain 1–4096 characters');
  if(input.variables!==undefined&&input.variables!==null&&(typeof input.variables!=='object'||Array.isArray(input.variables)))return fail(res,400,'Variables must be an object');
  let document;
  try{document=parse(input.query);}catch(error){return send(res,400,{errors:[error]});}
  const errors=validate(schema,document);
  if(errors.length)return send(res,400,{errors});
  const operation=getOperationAST(document,input.operationName);
  if(!operation)return fail(res,400,'Select one named operation');
  if(req.method==='GET'&&operation.operation!=='query')return send(res,405,{errors:[{message:'Mutations require POST'}]},undefined,{allow:'POST'});
  const result=await execute({schema,document,rootValue:root,variableValues:input.variables,operationName:input.operationName});
  console.info('trails_graphql '+JSON.stringify({release:RELEASE,method:req.method,operation:operation.name?.value||'anonymous',errors:result.errors?.length||0}));
  return send(res,result.data===undefined?400:200,result);
 }catch(error){console.info('trails_input_error '+error.message);return fail(res,400,error.message);}
}).listen(Number(process.env.PORT||3290),'0.0.0.0',()=>console.info('trails_ready release='+RELEASE+' graphql='+version));
