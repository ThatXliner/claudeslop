import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

async function launch(directory) {
  const child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, DATA_DIR: directory, PORT: '0', SEED: 'false', APP_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const port = await new Promise((resolve,reject) => {
    child.stdout.on('data', chunk => { const match = /listening on 127.0.0.1:(\d+)/.exec(String(chunk)); if(match) resolve(match[1]); });
    child.once('error', reject); child.once('exit', code => reject(new Error(`Server exited ${code}`)));
  });
  return { base: `http://127.0.0.1:${port}`, stop: async () => { child.kill('SIGTERM'); await once(child, 'exit'); } };
}

test('submission, voting, persistence, validation and request boundaries', async () => {
  const directory=mkdtempSync(join(tmpdir(),'claudeslop-test-'));
  let app=await launch(directory);
  try {
    const response=await fetch(`${app.base}/api/session`);
    const cookie=response.headers.get('set-cookie').split(';')[0];
    const {csrf}=await response.json();
    const request=(path,method='GET',data,headers={})=>fetch(`${app.base}${path}`,{method,headers:{cookie,'content-type':'application/json','x-csrf-token':csrf,...headers},body:data===undefined?undefined:JSON.stringify(data)});
    const input={title:'A real test game',url:'https://example.com/game',description:'A game with a playable browser link.',author:'Test creator',image:'',genre:'Puzzle',duration:'Quick play',ai_note:'Made with Codex.'};
    assert.equal((await request('/api/games')).status,200);
    let result=await request('/api/games','POST',input,{'x-csrf-token':'invalid'});assert.equal(result.status,403);
    result=await request('/api/games','POST',input,{origin:'https://evil.example'});assert.equal(result.status,403);
    result=await request('/api/games','POST',{...input,url:'javascript:alert(1)'});assert.equal(result.status,400);
    result=await request('/api/games','POST',{...input,image:'http://example.com/image.png'});assert.equal(result.status,400);
    result=await request('/api/games','POST',{...input,url:'http://127.0.0.1:3000/game'});assert.equal(result.status,400);
    result=await request('/api/games','POST',input);assert.equal(result.status,201);const {id}=await result.json();
    assert.equal((await request('/api/games','POST',input)).status,409);
    result=await request(`/api/games/${id}/vote`,'PUT',{voted:true});assert.deepEqual(await result.json(),{points:1,voted:true});
    result=await request(`/api/games/${id}/vote`,'PUT',{voted:true});assert.deepEqual(await result.json(),{points:1,voted:true});
    result=await request('/api/games?sort=new');const data=await result.json();assert.equal(data.games[0].title,input.title);assert.equal(data.games[0].voted,1);
    await app.stop();app=await launch(directory);
    result=await request('/api/games');const saved=await result.json();assert.equal(saved.games[0].points,1);assert.equal(saved.games[0].voted,1);
    result=await request(`/api/games/${id}/vote`,'PUT',{voted:false});assert.deepEqual(await result.json(),{points:0,voted:false});
    assert.equal((await request('/api/games/99999/vote','PUT',{voted:true})).status,404);
    assert.equal((await request(`/api/games/${id}/vote`,'PUT',{voted:'yes'})).status,400);
    const second=await request('/api/session','GET',undefined,{cookie:''});const secondCookie=second.headers.get('set-cookie').split(';')[0];const secondSession=await second.json();
    result=await request(`/api/games/${id}/vote`,'PUT',{voted:true},{cookie:secondCookie,'x-csrf-token':secondSession.csrf});assert.equal((await result.json()).points,1);
    result=await request('/api/games','POST',{...input,url:'https://example.com/2',title:'<img src=x onerror=alert(1)>'});assert.equal(result.status,201);
    result=await request('/api/games','POST',{...input,url:'https://example.com/3'});assert.equal(result.status,201);
    result=await request('/api/games','POST',{...input,url:'https://example.com/4'});assert.equal(result.status,429);
    result=await fetch(`${app.base}/`);assert.match(result.headers.get('content-security-policy'),/script-src 'self'/);assert.equal(result.headers.get('x-content-type-options'),'nosniff');assert.equal(result.status,200);
  } finally { await app.stop();rmSync(directory,{recursive:true,force:true}); }
});
