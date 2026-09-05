import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../web/media_composer.js', import.meta.url), 'utf8');
// Exercise the production geometry without a DOM or canvas renderer.
const geometry = source.slice(source.indexOf('  function captionLayout('), source.indexOf('  function createItem('));
function engine(ratios, aspect = 'auto', layout = 'auto', frames = []) {
  const state = { items: ratios.map((ar,i)=>({uid:String(i),ar,weight:1,x:0,y:0,w:400,h:400/ar,caption:'',frames:frames[i]||1})), gap:16, aspect, layout, canvasW:1600, canvasH:900 };
  return new Function('state', `
    const BASE_W=1600, BASE_H=900, CAPTION_MEASURE_SCALE=512, autoLongEdge=1536;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const itemWeight=it=>it.weight;
    const itemAsset=it=>({type:it.frames>1?'video':'image',frame_count:it.frames});
    const captionText=it=>it.caption.trim(),captionWidthRatio=()=>1,captionFontRatio=()=>.042,captionXRatio=()=>0;
    const captionMeasure={};
    const wrapLines=(ctx,text,width)=>text?[text]:[''];
    const canvasRatio=()=>state.aspect==='auto'?null:state.aspect.split(':').map(Number).reduce((a,b)=>a/b);
    const canvasSize=()=>({W:state.canvasW,H:state.canvasH});
    ${geometry}
    return {state,arrange,normalizeCanvas,outputResolution,contentBounds,resizedWidth,updateItemAspect,zoomAt,layoutAvailable,normalizeLayoutMode};
  `)(state);
}

test('mixed media layouts preserve aspect, containment, non-overlap and relative importance',()=>{
  const cases=[[1],[1,1],[1.8,1.8],[.6,1.8],[12,.25],[.6,1.8,1],[.6,.7,1.8,2.4],[12,.25,1,1.8]];
  for(const ratios of cases)for(const aspect of ['auto','16:9','9:16','1:1'])for(const layout of ['auto','2','3','grid']){
    const e=engine(ratios,aspect,layout,ratios.map((_,i)=>i%2?6:1));
    e.arrange();
    for(const it of e.state.items){
      assert.ok(Math.abs(it.w/it.h-it.ar)<.01);
      assert.ok(it.x>=-1 && it.y>=-1 && it.x+it.w<=e.state.canvasW+1 && it.y+it.h<=e.state.canvasH+1);
    }
    for(let i=0;i<ratios.length;i++)for(let j=i+1;j<ratios.length;j++){
      const a=e.state.items[i],b=e.state.items[j];
      assert.ok(a.x+a.w<=b.x+1||b.x+b.w<=a.x+1||a.y+a.h<=b.y+1||b.y+b.h<=a.y+1);
    }
    if(aspect!=='auto')assert.ok(Math.abs(e.state.canvasW/e.state.canvasH-aspect.split(':').map(Number).reduce((a,b)=>a/b))<.01);
  }
});

test('manual size importance survives Auto and fixed aspect canvas grows around manual placement',()=>{
  const e=engine([1,1],'16:9'); e.arrange();
  e.state.items[0].weight=2; e.arrange();
  const [a,b]=e.state.items;
  assert.ok(Math.abs(a.w*a.h/(b.w*b.h)-2)<.02);
  const before=e.state.canvasW;a.x+=before;a.w*=2;a.h*=2;
  const dimensions=[a.w,a.h,b.w,b.h]; e.normalizeCanvas();
  assert.deepEqual([a.w,a.h,b.w,b.h],dimensions);
  assert.ok(e.state.canvasW>before);
  assert.ok(Math.abs(e.state.canvasW/e.state.canvasH-16/9)<.01);
});

test('captions participate in layout bounds and normalization is stable',()=>{
  const e=engine([.6,1.8,1]);e.state.items[1].caption='A caption';e.arrange();
  const first=JSON.stringify(e.state.items);e.normalizeCanvas();
  assert.equal(JSON.stringify(e.state.items),first);
  const bounds=e.contentBounds();assert.ok(bounds.maxY<=e.state.canvasH+1);
});

test('corner resizing responds to vertical motion and preserves diagonal intent',()=>{
  const e=engine([1]),orig={w:400};
  assert.equal(e.resizedWidth(orig,'se',0,100,1),450);
  assert.equal(e.resizedWidth(orig,'nw',-100,-100,1),500);
  assert.equal(e.resizedWidth(orig,'se',100,50,2),500);
});

test('sheet refresh updates aspect while preserving manual area, center, weight and caption',()=>{
  const e=engine([1]);const it=e.state.items[0];it.caption='Keep';it.weight=2;
  const before={area:it.w*it.h,cx:it.x+it.w/2,cy:it.y+it.h/2};
  assert.equal(e.updateItemAspect(it,2),true);
  assert.ok(Math.abs(it.w/it.h-2)<1e-9);
  assert.ok(Math.abs(it.w*it.h-before.area)<1e-6);
  assert.equal(it.x+it.w/2,before.cx);assert.equal(it.y+it.h/2,before.cy);
  assert.equal(it.weight,2);assert.equal(it.caption,'Keep');
  assert.equal(e.updateItemAspect(it,2),false);
});

test('zoom keeps cursor anchor without modifying logical geometry or export',()=>{
  const e=engine([.6,1.8]);e.arrange();
  const before=JSON.stringify(e.state),output=e.outputResolution();
  const stage={left:100,top:50,width:1000,height:800};
  const rect={left:200,top:150,width:800,height:600},point={x:750,y:450};
  const p=e.zoomAt(1,2,point,rect,stage);
  const left=stage.left+(stage.width-1600)/2+p.panX,top=stage.top+(stage.height-1200)/2+p.panY;
  assert.equal((point.x-left)/1600,(point.x-rect.left)/rect.width);
  assert.equal((point.y-top)/1200,(point.y-rect.top)/rect.height);
  assert.equal(JSON.stringify(e.state),before);assert.deepEqual(e.outputResolution(),output);
});

test('layout availability follows item count and invalid modes fall back to Auto',()=>{
  const e=engine([]);
  for(const [n,expected] of [[0,[]],[1,['auto']],[2,['auto','2','grid']],[3,['auto','2','3','grid']],[4,['auto','2','3','grid']]]){
    assert.deepEqual(['auto','2','3','grid'].filter(mode=>e.layoutAvailable(mode,n)),expected);
  }
  const three=engine([1,1,1],'auto','3');three.arrange();assert.equal(three.state.layout,'3');
  three.state.items.pop();three.arrange();assert.equal(three.state.layout,'auto');
  three.state.layout='grid';three.state.items.pop();three.arrange();assert.equal(three.state.layout,'auto');
  three.state.items=[];three.state.layout='2';three.normalizeLayoutMode();assert.equal(three.state.layout,'auto');
  three.state.items=engine([1,1,1]).state.items;
  assert.equal(three.layoutAvailable('3'),true);
});
