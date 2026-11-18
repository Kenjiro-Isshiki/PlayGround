(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const ui = Object.fromEntries(['score','level','lives','bestScore','brickCount','progressFill','progressPercent','streak','overlay','overlayTitle','overlayText','playButton','buttonText','statusText','levelToast','soundToggle','soundIcon'].map(id => [id, document.getElementById(id)]));
  const COLORS = ['#d4fc57','#ff789b','#6ee6ff','#a796ff'];
  let score = 0, lives = 3, level = 1, streak = 0, best = Number(localStorage.getItem('neon-breaker-best') || 0);
  let bricks = [], balls = [], drops = [], particles = [], paddle, running = false, paused = false, started = false, last = 0, raf = 0;
  let wideUntil = 0, fireUntil = 0, ghostUntil = 0, soundOn = false, audio;
  const keys = {left:false,right:false};
  const rand = (a,b) => Math.random()*(b-a)+a;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  ui.bestScore.textContent = String(best).padStart(6,'0');

  function makeBricks(stage=level) {
    bricks=[];
    const rows = 4 + Math.min(stage,2), cols = 8, bw = 78, bh = 20, gap = 9, left = (W-(cols*bw+(cols-1)*gap))/2, top = 72;
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) {
      const hp = (stage===3 && r<2 && (c+r)%3===0) ? 2 : 1;
      bricks.push({x:left+c*(bw+gap),y:top+r*(bh+9),w:bw,h:bh,hp,maxHp:hp,color:COLORS[r%COLORS.length],alive:true});
    }
    updateProgress();
  }
  function freshPaddle() { paddle={x:W/2-55,y:H-47,w:110,h:12,target:W/2,vx:0}; }
  function serveBall() { balls=[{x:W/2,y:H-72,vx:rand(-2.2,2.2),vy:-5.5,r:7,fire:false,ghost:false,stuck:true,hitBricks:new Set()}]; }
  function resetRun() { score=0;lives=3;level=1;streak=0;wideUntil=fireUntil=ghostUntil=0;drops=[];particles=[];makeBricks();freshPaddle();serveBall();refreshUI(); }
  function refreshUI() {
    ui.score.textContent=String(score).padStart(6,'0');ui.level.textContent=String(level).padStart(2,'0');
    ui.lives.innerHTML=Array.from({length:3},(_,i)=>`<span style="opacity:${i<lives?1:.2}">♥</span>`).join(' ');
    ui.streak.textContent=streak;ui.bestScore.textContent=String(best).padStart(6,'0');updateProgress();
  }
  function updateProgress() {
    const total=bricks.length, remaining=bricks.filter(b=>b.alive).length;
    document.getElementById('brickCount').textContent=remaining;
    const pct=total?Math.round((total-remaining)/total*100):0;
    ui.progressFill.style.width=pct+'%';document.getElementById('progressPercent').textContent=pct+'%';
  }
  function setStatus(s){ui.statusText.textContent=s;}
  function startGame(){
    if(!started){resetRun();started=true;}
    ui.overlay.classList.add('hidden');running=true;paused=false;setStatus('IN THE ZONE');
    if(balls.some(b=>b.stuck)) balls.forEach(b=>{b.stuck=false;b.vy=-5.6;b.vx=rand(-2.2,2.2)});
    if(!raf){last=performance.now();raf=requestAnimationFrame(loop);}
  }
  function showOverlay(title,text,button='PLAY AGAIN'){
    running=false;paused=false;ui.overlayTitle.innerHTML=title;ui.overlayText.innerHTML=text;ui.buttonText.textContent=button;ui.overlay.classList.remove('hidden');
    setStatus(title.includes('Game')?'GAME OVER':'READY TO PLAY');
  }
  function togglePause(){if(!started)return;if(running){running=false;showOverlay('Take a<br><em>breather.</em>','Your run is paused.<br>Jump back in when you’re ready.','RESUME GAME');paused=true;setStatus('PAUSED');}else if(paused)startGame();else startGame();}
  function spawnDrop(x,y){if(Math.random()<.23){const types=['wide','multi','fire','ghost'];drops.push({x,y,vy:2.1,type:types[Math.floor(Math.random()*types.length)],r:11});}}
  function burst(x,y,color,n=8){for(let i=0;i<n;i++)particles.push({x,y,vx:rand(-2.6,2.6),vy:rand(-3,2),life:rand(18,34),max:34,color,r:rand(1.5,3.2)});}
  function sound(freq=440,duration=.06){if(!soundOn)return;try{audio ||= new AudioContext();const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=freq;o.type='sine';g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.start();o.stop(audio.currentTime+duration);}catch{}}
  function applyPower(type){const now=performance.now();sound(700,.13);if(type==='wide')wideUntil=now+12000;if(type==='fire')fireUntil=now+10000;if(type==='ghost')ghostUntil=now+10000;if(type==='multi'){
      const source=balls[0]||{x:paddle.x+paddle.w/2,y:paddle.y-12,vx:1,vy:-5,r:7};
      for(const angle of [-.42,.42])balls.push({x:source.x,y:source.y,vx:source.vx*Math.cos(angle)-source.vy*Math.sin(angle),vy:source.vx*Math.sin(angle)+source.vy*Math.cos(angle),r:7,stuck:false,hitBricks:new Set()});
    }
  }
  function hitBrick(ball,b){b.hp--;streak++;score+=b.hp>0?40:100;burst(ball.x,ball.y,b.color,b.hp?4:9);sound(b.hp?380:540,.045);if(b.hp<=0){b.alive=false;spawnDrop(b.x+b.w/2,b.y+b.h/2);}if(ball.fire||ball.ghost){if(b.hp<=0)b.alive=false;}refreshUI();}
  function loseLife(){lives--;streak=0;refreshUI();burst(paddle.x+paddle.w/2,H-12,'#ff789b',18);sound(140,.3);if(lives<=0){running=false;if(score>best){best=score;localStorage.setItem('neon-breaker-best',best);refreshUI();}showOverlay('Game<br><em>over.</em>','That was a good run.<br>Want another shot?','PLAY AGAIN');return;}
    serveBall();running=false;showOverlay('One more<br><em>try.</em>','You’ve got this. Get back out there.','CONTINUE');paused=true;setStatus('BALL LOST');
  }
  function movePaddle(){paddle.w=performance.now()<wideUntil?158:110;const old=paddle.x;const target=keys.left?paddle.target-7:keys.right?paddle.target+7:paddle.target;paddle.target=target;paddle.x=clamp(paddle.x+(target-paddle.w/2-paddle.x)*.22,8,W-paddle.w-8);paddle.vx=paddle.x-old;paddle.y=H-47;}
  function update(dt){
    const scale=dt/16.67, now=performance.now();movePaddle();
    for(const b of balls){if(b.stuck){b.x=paddle.x+paddle.w/2;b.y=paddle.y-9;continue;}b.x+=b.vx*scale;b.y+=b.vy*scale;
      if(b.x-b.r<8){b.x=8+b.r;b.vx=Math.abs(b.vx);sound(250,.025);}if(b.x+b.r>W-8){b.x=W-8-b.r;b.vx=-Math.abs(b.vx);sound(250,.025);}if(b.y-b.r<8){b.y=8+b.r;b.vy=Math.abs(b.vy);}
      if(b.vy>0&&b.y+b.r>=paddle.y&&b.y-b.r<=paddle.y+paddle.h&&b.x>=paddle.x&&b.x<=paddle.x+paddle.w){const rel=(b.x-(paddle.x+paddle.w/2))/(paddle.w/2);b.vx=rel*5.2+paddle.vx*.12;b.vy=-Math.sqrt(Math.max(14,b.vx*b.vx+31));b.y=paddle.y-b.r-1;streak=0;sound(330,.04);}
      if(!b.fire&&!b.ghost){for(const brick of bricks){if(!brick.alive)continue;if(b.x+b.r>brick.x&&b.x-b.r<brick.x+brick.w&&b.y+b.r>brick.y&&b.y-b.r<brick.y+brick.h){const prevY=b.y-b.vy*scale;if(prevY+b.r<=brick.y||prevY-b.r>=brick.y+brick.h)b.vy*=-1;else b.vx*=-1;hitBrick(b,brick);break;}}}
      else{for(const brick of bricks){const overlap=brick.alive&&b.x+b.r>brick.x&&b.x-b.r<brick.x+brick.w&&b.y+b.r>brick.y&&b.y-b.r<brick.y+brick.h;if(overlap&&!b.hitBricks.has(brick)){hitBrick(b,brick);b.hitBricks.add(brick);}else if(!overlap)b.hitBricks.delete(brick);}}
    }
    balls=balls.filter(b=>b.y<H+20);if(!balls.length)loseLife();
    for(const d of drops){d.y+=d.vy*scale;if(d.y+d.r>=paddle.y&&d.y-d.r<=paddle.y+paddle.h&&d.x>paddle.x&&d.x<paddle.x+paddle.w){applyPower(d.type);d.caught=true;burst(d.x,d.y,{wide:'#d4fc57',multi:'#6ee6ff',fire:'#ff9971',ghost:'#a796ff'}[d.type],12);}}
    drops=drops.filter(d=>!d.caught&&d.y<H+20);
    for(const p of particles){p.x+=p.vx*scale;p.y+=p.vy*scale;p.vy+=.03*scale;p.life-=scale;}particles=particles.filter(p=>p.life>0);
    if(bricks.length&&bricks.every(b=>!b.alive))nextLevel();
  }
  function nextLevel(){running=false;if(level>=3){if(score>best){best=score;localStorage.setItem('neon-breaker-best',best);}refreshUI();showOverlay('You<br><em>did it!</em>','Every last brick, gone.<br>That’s a new high score energy.','PLAY AGAIN');return;}
    ui.levelToast.classList.add('show');setTimeout(()=>ui.levelToast.classList.remove('show'),1250);level++;makeBricks();balls.forEach(b=>{b.vy=-Math.abs(b.vy)*1.06;b.stuck=false});refreshUI();setTimeout(()=>{if(started&&lives>0){running=true;last=performance.now();}},900);
  }
  function rounded(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  function draw(){
    ctx.clearRect(0,0,W,H);
    const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#121624');bg.addColorStop(1,'#111522');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(195,205,234,.035)';ctx.lineWidth=1;for(let x=20;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=20;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    ctx.strokeStyle='rgba(151,166,200,.12)';ctx.strokeRect(7.5,7.5,W-15,H-15);
    bricks.forEach(b=>{if(!b.alive)return;ctx.save();ctx.shadowColor=b.color;ctx.shadowBlur=b.hp>1?12:5;ctx.fillStyle=b.color;rounded(b.x,b.y,b.w,b.h,4);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='rgba(255,255,255,.21)';rounded(b.x+3,b.y+3,b.w-6,3,2);ctx.fill();if(b.hp>1){ctx.fillStyle='#151827';ctx.beginPath();ctx.arc(b.x+b.w/2,b.y+b.h/2,3,0,Math.PI*2);ctx.fill();}ctx.restore();});
    drops.forEach(d=>{const color={wide:'#d4fc57',multi:'#6ee6ff',fire:'#ff9971',ghost:'#a796ff'}[d.type];ctx.save();ctx.translate(d.x,d.y);ctx.rotate(Math.sin(performance.now()/220)*.12);ctx.shadowColor=color;ctx.shadowBlur=14;ctx.fillStyle=color;rounded(-d.r,-d.r,d.r*2,d.r*2,4);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#171a27';ctx.font='bold 12px DM Mono';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText({wide:'↔',multi:'✣',fire:'✦',ghost:'◉'}[d.type],0,1);ctx.restore();});
    const now=performance.now();balls.forEach(b=>{const fire=now<fireUntil,ghost=now<ghostUntil;ctx.save();ctx.shadowColor=fire?'#ff8b61':ghost?'#a796ff':'#eaffab';ctx.shadowBlur=fire||ghost?22:14;ctx.fillStyle=fire?'#ffb273':ghost?'#d4caff':'#f3ffc9';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.restore();});
    const active=now<wideUntil;ctx.save();ctx.shadowColor=active?'#d4fc57':'#9eabff';ctx.shadowBlur=active?22:13;const grad=ctx.createLinearGradient(paddle.x,paddle.y,paddle.x+paddle.w,paddle.y);grad.addColorStop(0,active?'#d4fc57':'#9fa9ff');grad.addColorStop(.5,active?'#efffac':'#d0d5ff');grad.addColorStop(1,active?'#d4fc57':'#9fa9ff');ctx.fillStyle=grad;rounded(paddle.x,paddle.y,paddle.w,paddle.h,6);ctx.fill();ctx.restore();
    particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;
    if(now<fireUntil||now<ghostUntil){ctx.font='9px DM Mono';ctx.textAlign='left';ctx.fillStyle=now<fireUntil?'#ff9971':'#a796ff';ctx.fillText(now<fireUntil?'✦ FIREBALL':'◉ GHOST BALL',19,H-19);}
  }
  function loop(now){raf=requestAnimationFrame(loop);const dt=Math.min(32,now-last||16);last=now;if(running)update(dt);draw();}
  ui.playButton.addEventListener('click',()=>{
    const finished=started&&(lives<=0||(level>=3&&bricks.length&&bricks.every(b=>!b.alive)));
    if(finished){resetRun();started=true;paused=false;}
    startGame();
  });
  document.getElementById('restartButton').addEventListener('click',()=>{resetRun();started=true;paused=false;startGame();});
  ui.soundToggle.addEventListener('click',()=>{soundOn=!soundOn;ui.soundIcon.textContent=soundOn?'♫':'♩';ui.soundToggle.style.color=soundOn?'#d4fc57':'#858795';if(soundOn)sound(600,.08);});
  window.addEventListener('keydown',e=>{
    if(['ArrowLeft','ArrowRight',' ','Spacebar'].includes(e.key))e.preventDefault();
    if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')keys.left=true;
    if(e.key==='ArrowRight'||e.key.toLowerCase()==='d')keys.right=true;
    if(e.code==='Space'){if(!started||!running)ui.playButton.click();else togglePause();}
    if(e.key==='Escape')togglePause();
  });
  window.addEventListener('keyup',e=>{if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')keys.left=false;if(e.key==='ArrowRight'||e.key.toLowerCase()==='d')keys.right=false;});
  function aim(clientX){const rect=canvas.getBoundingClientRect();const x=(clientX-rect.left)/rect.width*W;paddle.target=clamp(x,20,W-20);}
  canvas.addEventListener('pointermove',e=>{aim(e.clientX);});
  canvas.addEventListener('pointerdown',e=>{aim(e.clientX);if(!started||!running)ui.playButton.click();});
  ui.overlay.addEventListener('pointerdown',e=>{if(e.target===ui.overlay)ui.playButton.click();});
  window.addEventListener('blur',()=>{keys.left=keys.right=false;if(running)togglePause();});
  resetRun();draw();
})();
