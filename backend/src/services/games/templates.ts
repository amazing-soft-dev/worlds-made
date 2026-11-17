/**
 * Starter templates, one per genre. The model fills in a known-good game loop instead of starting from a blank page.
 * Every template is a complete, original, single-file canvas game that passes the static scanner: title screen,
 * instructions, keyboard and touch controls, score, game over, restart, and a score report to the parent frame.
 */
export const GENRES = ['runner', 'catcher', 'shooter', 'quiz'] as const;
export type Genre = (typeof GENRES)[number];

const HEAD = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>{{TITLE}}</title>
<style>html,body{margin:0;height:100%;background:#0b1020;color:#fff;font-family:system-ui,sans-serif;touch-action:none;overflow:hidden}canvas{display:block;margin:0 auto;max-width:100%;max-height:100vh;background:hsl({{HUE}},45%,13%)}</style></head><body><canvas id="c" width="360" height="540"></canvas><script>
(function(){
var TITLE='{{TITLE}}',HUE={{HUE}};
var cv=document.getElementById('c'),g=cv.getContext('2d'),W=cv.width,H=cv.height;
var state='title',score=0,best=0,keys={},px=null,py=null,tick=0;
function col(l,s,a){return 'hsla('+HUE+','+(s==null?70:s)+'%,'+l+'%,'+(a==null?1:a)+')'}
function report(){try{parent.postMessage({type:'score',value:score},'*')}catch(e){}}
function over(){state='over';if(score>best)best=score;report()}
function begin(){reset();tick=0;score=0;state='play'}
function text(s,x,y,size,color,align){g.font='bold '+size+'px system-ui,sans-serif';g.fillStyle=color||'#fff';g.textAlign=align||'center';g.fillText(s,x,y)}
function overlay(lines){g.fillStyle='rgba(0,0,0,.55)';g.fillRect(0,0,W,H);for(var i=0;i<lines.length;i++)text(lines[i][0],W/2,200+i*38,lines[i][1],lines[i][2])}
addEventListener('keydown',function(e){keys[e.key]=true;if(e.key===' '||e.key==='Enter'){if(state!=='play')begin();else act()}if(e.key===' '||e.key.indexOf('Arrow')===0)e.preventDefault()});
addEventListener('keyup',function(e){keys[e.key]=false});
addEventListener('error',function(e){try{parent.postMessage({type:'error',message:String(e.message||'error').slice(0,200)},'*')}catch(x){}});
function pos(e){var r=cv.getBoundingClientRect();px=(e.clientX-r.left)*W/r.width;py=(e.clientY-r.top)*H/r.height}
cv.addEventListener('pointermove',pos);
cv.addEventListener('pointerdown',function(e){pos(e);if(state!=='play')begin();else act(px,py)});
`;

const TAIL = `
function frame(){g.clearRect(0,0,W,H);if(state==='play'){tick++;step()}draw();
if(state==='title')overlay([[TITLE,30,col(75)],['Press Space or tap to start',16,'#fff'],[HELP,14,'#cfd6ff']]);
if(state==='over')overlay([['Game over',32,'#fff'],['Score '+score+'   Best '+best,20,col(75)],['Press Space or tap to play again',16,'#fff']]);
requestAnimationFrame(frame)}
reset();frame();
})();
</script></body></html>`;

const RUNNER = `var HELP='Space, Up or tap to jump',GY=H-80,y,vy,obs,speed;
function reset(){y=0;vy=0;obs=[];speed=3.2}
function act(){if(y===0)vy=12}
addEventListener('keydown',function(e){if(e.key==='ArrowUp'&&state==='play')act()});
function step(){vy-=0.65;y+=vy;if(y<=0){y=0;vy=0}
speed=3.2+tick/900;
if(tick%Math.max(38,85-Math.floor(tick/120))===0)obs.push({x:W+10,w:18+Math.random()*18,h:28+Math.random()*34});
for(var i=0;i<obs.length;i++)obs[i].x-=speed;
obs=obs.filter(function(o){return o.x+o.w>-5});
score=Math.floor(tick/8);
for(var j=0;j<obs.length;j++){var o=obs[j];if(86>o.x&&60<o.x+o.w&&y<o.h-2){over();return}}}
function draw(){g.fillStyle=col(30,40);g.fillRect(0,GY,W,H-GY);g.fillStyle=col(60);g.fillRect(60,GY-34-y,26,34);
g.fillStyle=col(80,80);for(var i=0;i<obs.length;i++){var o=obs[i];g.fillRect(o.x,GY-o.h,o.w,o.h)}
text('Score '+score,W/2,40,22,'#fff')}`;

const CATCHER = `var HELP='Arrows or drag to move. Catch stars, dodge rocks',items,lives,bx;
function reset(){items=[];lives=3;bx=W/2}
function act(){}
function step(){var d=(keys.ArrowRight||keys.d?6:0)-(keys.ArrowLeft||keys.a?6:0);bx+=d;if(px!==null&&d===0)bx+=(px-bx)*0.25;bx=Math.max(34,Math.min(W-34,bx));
if(tick%Math.max(20,50-Math.floor(tick/150))===0)items.push({x:20+Math.random()*(W-40),y:-10,bad:Math.random()<0.2,done:false});
for(var i=0;i<items.length;i++){var it=items[i];it.y+=2.5+tick/1200;
if(it.y>H-50&&it.y<H-20&&Math.abs(it.x-bx)<38){it.done=true;if(it.bad)lives--;else score++}
else if(it.y>H+10){it.done=true;if(!it.bad)lives--}}
items=items.filter(function(it){return !it.done});if(lives<=0)over()}
function draw(){g.fillStyle=col(60);g.fillRect(bx-34,H-40,68,14);
for(var i=0;i<items.length;i++){var it=items[i];g.fillStyle=it.bad?'#9aa0b4':col(80,90);g.beginPath();g.arc(it.x,it.y,10,0,6.3);g.fill()}
text('Score '+score,70,36,20,'#fff');text('Lives '+lives,W-70,36,20,'#fff')}`;

const SHOOTER = `var HELP='Arrows or drag to move. Your ship fires by itself',sx,bullets,foes,lives;
function reset(){sx=W/2;bullets=[];foes=[];lives=3}
function act(){}
function step(){var d=(keys.ArrowRight||keys.d?6:0)-(keys.ArrowLeft||keys.a?6:0);sx+=d;if(px!==null&&d===0)sx+=(px-sx)*0.2;sx=Math.max(20,Math.min(W-20,sx));
if(tick%14===0)bullets.push({x:sx,y:H-60});
if(tick%Math.max(25,70-Math.floor(tick/60))===0)foes.push({x:20+Math.random()*(W-40),y:-20,s:1+Math.random()*1.2+tick/2000});
for(var i=0;i<bullets.length;i++)bullets[i].y-=8;
for(var j=0;j<foes.length;j++)foes[j].y+=foes[j].s;
for(var a=0;a<foes.length;a++){var f=foes[a];
for(var b=0;b<bullets.length;b++){var u=bullets[b];if(Math.abs(u.x-f.x)<18&&Math.abs(u.y-f.y)<18){u.y=-99;f.dead=true;score++}}
if(!f.dead&&f.y>H-40){f.dead=true;lives--}
else if(!f.dead&&Math.abs(f.x-sx)<24&&f.y>H-80){f.dead=true;lives--}}
foes=foes.filter(function(f){return !f.dead});bullets=bullets.filter(function(u){return u.y>-10});
if(lives<=0)over()}
function draw(){g.fillStyle=col(65);g.beginPath();g.moveTo(sx,H-70);g.lineTo(sx-16,H-40);g.lineTo(sx+16,H-40);g.fill();
g.fillStyle='#fff';for(var i=0;i<bullets.length;i++)g.fillRect(bullets[i].x-2,bullets[i].y,4,10);
g.fillStyle=col(75,85);for(var j=0;j<foes.length;j++){g.fillRect(foes[j].x-12,foes[j].y-12,24,24)}
text('Score '+score,70,36,20,'#fff');text('Lives '+lives,W-70,36,20,'#fff')}`;

const QUIZ = `var HELP='Press 1 to 4 or tap an answer. 10 seconds each',q,timer,lives,opts;
function ask(){var a=2+Math.floor(Math.random()*(8+score)),b=2+Math.floor(Math.random()*(8+score)),r=a+b,ans=[r],k;
while(ans.length<4){k=r+Math.floor(Math.random()*9)-4;if(ans.indexOf(k)<0&&k>0)ans.push(k)}
ans.sort(function(){return Math.random()-0.5});q={text:a+' + '+b+' = ?',right:ans.indexOf(r)};opts=ans;timer=600}
function reset(){lives=3;ask()}
function pick(i){if(i===q.right){score++;ask()}else{lives--;ask();if(lives<=0)over()}}
function act(x,y){if(y==null)return;for(var i=0;i<4;i++){var top=250+i*62;if(y>=top&&y<=top+50){pick(i);return}}}
addEventListener('keydown',function(e){var n=parseInt(e.key,10);if(state==='play'&&n>=1&&n<=4)pick(n-1)});
function step(){timer--;if(timer<=0){lives--;ask();if(lives<=0)over()}}
function draw(){text(q.text,W/2,150,44,'#fff');text('Time '+Math.ceil(timer/60),W/2,200,18,col(75));
for(var i=0;i<4;i++){g.fillStyle=col(30,50);g.fillRect(40,250+i*62,W-80,50);text((i+1)+'   '+opts[i],W/2,284+i*62,24,'#fff')}
text('Score '+score,70,36,20,'#fff');text('Lives '+lives,W-70,36,20,'#fff')}`;

const GAMES: Record<Genre, string> = { runner: RUNNER, catcher: CATCHER, shooter: SHOOTER, quiz: QUIZ };

/** Titles go into HTML and a JS string, so only plain characters survive. */
export function safeTitle(title: string): string {
  const t = title.replace(/[^A-Za-z0-9 .,!?'-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return t || 'My Game';
}

export function renderTemplate(genre: Genre, title: string, hue = 200): string {
  const h = Math.max(0, Math.min(359, Math.round(hue)));
  return (HEAD + GAMES[genre] + TAIL).replaceAll('{{TITLE}}', safeTitle(title)).replaceAll('{{HUE}}', String(h));
}

/** Picks a genre from the request. Mechanics are free to ask for; names and characters are handled by moderation. */
export function pickGenre(prompt: string): Genre {
  const p = prompt.toLowerCase();
  if (/\b(quiz|trivia|math|maths|questions?|riddles?|spelling)\b/.test(p)) return 'quiz';
  if (/\b(shoot\w*|space|invaders?|blast\w*|enem(y|ies)|alien\w*|laser\w*)\b/.test(p)) return 'shooter';
  if (/\b(catch\w*|collect\w*|falling|basket|stars?|fruit)\b/.test(p)) return 'catcher';
  return 'runner';
}

export function templateFor(genre: Genre): string {
  return renderTemplate(genre, 'Your Game Title');
}
