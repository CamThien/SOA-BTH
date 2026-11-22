const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const children = [];
let logs = '';
function start(cwd, file, env) {
 const child = spawn(process.execPath, [file], { cwd:path.join(root,cwd), env:{...process.env,...env}, windowsHide:true, stdio:['ignore','pipe','pipe'] });
 child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);children.push(child);
}
async function wait(port) {
 for(let i=0;i<80;i++) {try {await fetch(`http://localhost:${port}/`);return;}catch{} await new Promise(r=>setTimeout(r,250));}
 throw Error(`Service ${port} did not start\n${logs}`);
}
let token;
let checks=0;
async function api(port,method,url,body,status=200,auth=true) {
 const response = await fetch(`http://localhost:${port}${url}`,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await response.json();
 assert.equal(response.status,status,`${method} ${url}: ${JSON.stringify(data)}`);checks++;return data;
}
(async()=>{
 start('','server.js',{PORT:'3300'});
 start('product-management-service','dist/main.js',{PORT:'3301',AUTH_SERVICE_URL:'http://localhost:3300'});
 start('order-management-service','dist/main.js',{PORT:'3302',AUTH_SERVICE_URL:'http://localhost:3300',PRODUCT_SERVICE_URL:'http://localhost:3301'});
 await Promise.all([3300,3301,3302].map(wait));
 token=(await api(3300,'POST','/',{userName:'admin',password:'e10adc3949ba59abbe56e057f20f883e'},200,false)).token;
 await api(3301,'GET','/products',undefined,401,false);
 await api(3302,'GET','/orders',undefined,401,false);
 const goodToken=token;token='invalid';await api(3302,'GET','/order_items',undefined,401);token=goodToken;
 await api(3301,'POST','/products',{name:'Invalid',price:-1,quantity:2},400);
 const product=await api(3301,'POST','/products',{name:'SOA integration test',description:'Temporary test data',price:12.34,quantity:10},201);
 let order;
 try {
  await api(3301,'PUT',`/products/${product.id}`,{quantity:12});
  for (const field of ['name','price','quantity']) {
   await api(3301,'PUT',`/products/${product.id}`,{[field]:null},400);
  }
  for (const invalid of [{price:100000000},{quantity:2147483648}]) {
   await api(3301,'POST','/products',{name:'Overflow',price:1,quantity:1,...invalid},400);
   await api(3301,'PUT',`/products/${product.id}`,invalid,400);
  }
  await api(3301,'GET',`/products/${product.id}`);
  await api(3302,'POST','/orders',{customer_name:'Test',customer_email:'test@example.com',items:[{product_id:product.id,quantity:13}]},400);
  await api(3302,'POST','/orders',{customer_name:'Test',customer_email:'bad',items:[]},400);
  order=await api(3302,'POST','/orders',{customer_name:'Test',customer_email:'test@example.com',items:[{product_id:product.id,quantity:2},{product_id:product.id,quantity:1}]},201);
  assert.equal(order.items.length,1);assert.equal(Number(order.total_amount),37.02);assert.equal(order.items[0].quantity,3);
  await api(3302,'GET','/orders');await api(3302,'GET','/order_items');
  const item=await api(3302,'POST','/order_items',{order_id:order.id,product_id:product.id,quantity:2,unit_price:0,total_price:0},201);
  assert.equal(Number(item.total_price),24.68);
  await api(3302,'GET',`/order_items/${item.id}`);
  await api(3302,'PUT',`/order_items/${item.id}`,{quantity:10},400);
  await api(3302,'PUT',`/order_items/${item.id}`,{quantity:1});
  let current=await api(3302,'GET',`/orders/${order.id}`);assert.equal(Number(current.total_amount),49.36);
  await api(3302,'DELETE',`/order_items/${item.id}`);
  current=await api(3302,'GET',`/orders/${order.id}`);assert.equal(Number(current.total_amount),37.02);
  await api(3302,'PUT',`/orders/${order.id}`,{status:'bad'},400);
  await api(3302,'PUT',`/orders/${order.id}`,{status:'completed'});
  await api(3302,'PUT',`/order_items/${order.items[0].id}`,{quantity:1},400);
  await api(3302,'DELETE',`/orders/${order.id}`);order=null;
  await api(3302,'GET',`/order_items/${item.id}`,undefined,404);
  console.log(`PASS: ${checks} API checks plus price, quantity and total assertions`);
 } finally {
  if(order) await api(3302,'DELETE',`/orders/${order.id}`);
  await api(3301,'DELETE',`/products/${product.id}`);
 }
})().catch(e=>{console.error(e);console.error(logs.slice(-5000));process.exitCode=1;}).finally(()=>{for(const child of children)child.kill();});
